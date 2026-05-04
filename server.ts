import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = 5000;
const httpServer = createHttpServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.path}`);
  }
  next();
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
    });
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, settings: user.settings } });
  } catch (error: any) {
    console.error("Login Error:", error);
    if (error.message.includes("could not write init file") || error.message.includes("Error querying the database")) {
      return res.status(503).json({ 
        error: "Database server error. This usually means the database server is out of disk space or has permission issues. Please check your DB server (FATAL: could not write init file)." 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(401).json({ error: "User not found" });
    
    // Check and take balance snapshot for the current month if it doesn't exist
    try {
      const now = new Date();
      const monthStr = now.toISOString().substring(0, 7);
      const existing = await prisma.balanceHistory.findUnique({
        where: { userId_month: { userId: user.id, month: monthStr } }
      });
      
      if (!existing) {
        const accounts = await prisma.account.findMany({
          where: { userId: user.id, showInTotals: true }
        });
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        await prisma.balanceHistory.create({
          data: {
            userId: user.id,
            month: monthStr,
            totalBalance,
            details: accounts.map(a => ({ id: a.id, name: a.name, balance: a.balance }))
          }
        });
      }
    } catch (snapshotError) {
      console.error("Failed to take balance snapshot:", snapshotError);
    }

    res.json({ id: user.id, email: user.email, displayName: user.displayName, photoURL: user.photoURL, settings: user.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/auth/me", authenticateToken, async (req: any, res) => {
  try {
    const { displayName, photoURL } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { displayName, photoURL },
    });
    res.json({ id: user.id, email: user.email, displayName: user.displayName, photoURL: user.photoURL, settings: user.settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/verify-password", authenticateToken, async (req: any, res) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid password" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- DATA ROUTES ---

// Accounts
app.get("/api/accounts", authenticateToken, async (req: any, res) => {
  try {
    const accounts = await prisma.account.findMany({ where: { userId: req.user.userId } });
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/accounts", authenticateToken, async (req: any, res) => {
  try {
    const account = await prisma.account.create({
      data: { ...req.body, userId: req.user.userId },
    });
    notifyUser(req.user.userId, "data:updated", { type: "accounts" });
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/accounts/:id", authenticateToken, async (req: any, res) => {
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: req.body,
    });
    notifyUser(req.user.userId, "data:updated", { type: "accounts" });
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/accounts/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id, userId: req.user.userId } });
    notifyUser(req.user.userId, "data:updated", { type: "accounts" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Categories
app.get("/api/categories", authenticateToken, async (req: any, res) => {
  try {
    const categories = await prisma.category.findMany({ 
      where: { userId: req.user.userId },
      include: { children: true }
    });
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/categories", authenticateToken, async (req: any, res) => {
  try {
    const { parentId, ...data } = req.body;
    const createData: any = { ...data, userId: req.user.userId };
    
    if (parentId) {
      createData.parent = { connect: { id: parentId } };
    }

    const category = await prisma.category.create({
      data: createData,
    });
    notifyUser(req.user.userId, "data:updated", { type: "categories" });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/categories/:id", authenticateToken, async (req: any, res) => {
  try {
    const { parentId, ...data } = req.body;
    const updateData: any = { ...data };
    
    if (parentId === null) {
      updateData.parent = { disconnect: true };
    } else if (parentId) {
      updateData.parent = { connect: { id: parentId } };
    }

    const category = await prisma.category.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: updateData,
    });
    notifyUser(req.user.userId, "data:updated", { type: "categories" });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/categories/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id, userId: req.user.userId } });
    notifyUser(req.user.userId, "data:updated", { type: "categories" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transactions
app.get("/api/transactions", authenticateToken, async (req: any, res) => {
  try {
    const transactions = await prisma.transaction.findMany({ 
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/transactions", authenticateToken, async (req: any, res) => {
  try {
    const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    // Atomic transaction update
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: req.user.userId,
          accountId,
          targetAccountId: targetAccountId || null,
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          amount: numAmount,
          type,
          description: description || '',
          createdAt: createdAt ? new Date(createdAt) : new Date()
        },
      });

      // Update account balances
      if (type === 'expense') {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: numAmount } }
        });
      } else if (type === 'income') {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: numAmount } }
        });
      } else if (type === 'transfer' && targetAccountId) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: numAmount } }
        });
        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: { increment: numAmount } }
        });
      }

      return transaction;
    });

    notifyUser(req.user.userId, "data:updated", { type: "transactions" });
    res.json(result);
  } catch (error: any) {
    console.error("Transaction Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/transactions/:id", authenticateToken, async (req: any, res) => {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    await prisma.$transaction(async (tx) => {
      // Revert balance changes
      if (transaction.type === 'expense') {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: transaction.amount } }
        });
      } else if (transaction.type === 'income') {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { decrement: transaction.amount } }
        });
      } else if (transaction.type === 'transfer' && transaction.targetAccountId) {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: transaction.amount } }
        });
        await tx.account.update({
          where: { id: transaction.targetAccountId },
          data: { balance: { decrement: transaction.amount } }
        });
      }

      await tx.transaction.delete({ where: { id: req.params.id } });
    });

    notifyUser(req.user.userId, "data:updated", { type: "transactions" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/transactions/:id", authenticateToken, async (req: any, res) => {
  try {
    const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const oldTransaction = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!oldTransaction) return res.status(404).json({ error: "Transaction not found" });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert old balance changes
      if (oldTransaction.type === 'expense') {
        await tx.account.update({
          where: { id: oldTransaction.accountId },
          data: { balance: { increment: oldTransaction.amount } }
        });
      } else if (oldTransaction.type === 'income') {
        await tx.account.update({
          where: { id: oldTransaction.accountId },
          data: { balance: { decrement: oldTransaction.amount } }
        });
      } else if (oldTransaction.type === 'transfer' && oldTransaction.targetAccountId) {
        await tx.account.update({
          where: { id: oldTransaction.accountId },
          data: { balance: { increment: oldTransaction.amount } }
        });
        await tx.account.update({
          where: { id: oldTransaction.targetAccountId },
          data: { balance: { decrement: oldTransaction.amount } }
        });
      }

      // 2. Update transaction
      const updatedTransaction = await tx.transaction.update({
        where: { id: req.params.id },
        data: {
          accountId,
          targetAccountId: targetAccountId || null,
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          amount: numAmount,
          type,
          description: description || '',
          createdAt: createdAt ? new Date(createdAt) : new Date()
        },
      });

      // 3. Apply new balance changes
      if (type === 'expense') {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: numAmount } }
        });
      } else if (type === 'income') {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: numAmount } }
        });
      } else if (type === 'transfer' && targetAccountId) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: numAmount } }
        });
        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: { increment: numAmount } }
        });
      }

      return updatedTransaction;
    });

    notifyUser(req.user.userId, "data:updated", { type: "transactions" });
    res.json(result);
  } catch (error: any) {
    console.error("Update Transaction Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Goals
app.get("/api/goals", authenticateToken, async (req: any, res) => {
  try {
    const goals = await prisma.goal.findMany({ where: { userId: req.user.userId } });
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/goals", authenticateToken, async (req: any, res) => {
  try {
    const { targetAmount, currentAmount, deadline, ...rest } = req.body;
    const goal = await prisma.goal.create({
      data: { 
        ...rest, 
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount || 0),
        deadline: deadline ? new Date(deadline) : null,
        userId: req.user.userId 
      },
    });
    notifyUser(req.user.userId, "data:updated", { type: "goals" });
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/goals/:id", authenticateToken, async (req: any, res) => {
  try {
    const { targetAmount, currentAmount, deadline, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (targetAmount !== undefined) updateData.targetAmount = Number(targetAmount);
    if (currentAmount !== undefined) updateData.currentAmount = Number(currentAmount);
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;

    const goal = await prisma.goal.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: updateData,
    });
    notifyUser(req.user.userId, "data:updated", { type: "goals" });
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/goals/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.goal.delete({ where: { id: req.params.id, userId: req.user.userId } });
    notifyUser(req.user.userId, "data:updated", { type: "goals" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PlanGrid (Complex Grid)
app.get("/api/plan-grids", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const planGrids = await prisma.planGrid.findMany({
      where: { userId }
    });
    res.json(planGrids);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/plan-grid/:type", authenticateToken, async (req: any, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.userId;

    // Try to find the specific type
    let planGrid = await prisma.planGrid.findFirst({
      where: { userId, type }
    });

    // Backward compatibility: if not found, check for old "all-in-one" format
    if (!planGrid) {
      const oldPlanGrid = await prisma.planGrid.findFirst({
        where: { userId, type: 'all' } // Assuming old format used 'all' or similar
      });
      
      if (oldPlanGrid) {
        // Found old format, distribute data
        const oldData = oldPlanGrid.data as any;
        
        // Distribute to new format
        const types = ['config', 'cashbacks', 'comments', 'budget', 'goals'];
        for (const t of types) {
          if (oldData[t]) {
            await prisma.planGrid.upsert({
              where: { userId_type: { userId, type: t } },
              update: { data: oldData[t] },
              create: { userId, type: t, data: oldData[t] }
            });
          }
        }
        
        // Delete old format
        await prisma.planGrid.delete({ where: { id: oldPlanGrid.id } });
        
        // Return requested type
        planGrid = await prisma.planGrid.findFirst({
          where: { userId, type }
        });
      }
    }

    res.json(planGrid ? planGrid.data : null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/plan-grid/:type", authenticateToken, async (req: any, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.userId;
    const data = req.body;

    const planGrid = await prisma.planGrid.upsert({
      where: { userId_type: { userId, type } },
      update: { data },
      create: { userId, type, data }
    });
    notifyUser(userId, "data:updated", { type: "plan-grid", planType: type });
    res.json(planGrid.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Currencies
app.get("/api/currencies", authenticateToken, async (req: any, res) => {
  try {
    const currencies = await prisma.currency.findMany();
    res.json(currencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/currencies", authenticateToken, async (req: any, res) => {
  try {
    const currency = await prisma.currency.create({ data: req.body });
    res.json(currency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/currencies/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id, ...data } = req.body;
    const currency = await prisma.currency.upsert({
      where: { id: req.params.id },
      update: data,
      create: { ...data, id: req.params.id }
    });
    res.json(currency);
  } catch (error: any) {
    console.error("Update Currency Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/currencies/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.currency.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/currencies/seed", authenticateToken, async (req: any, res) => {
  try {
    const count = await prisma.currency.count();
    if (count > 0) {
      return res.json({ success: true });
    }

    const defaults = [
      { currency: 'рубль', name: 'RUB - Russia (руб)', iso: 'RUB', rate: 1.0, symbol: '₽' },
      { currency: 'доллар', name: 'USD - USA (US$)', iso: 'USD', rate: 1.0, symbol: '$' },
      { currency: 'евро', name: 'EUR - European Union (€)', iso: 'EUR', rate: 1.0, symbol: '€' },
      { currency: 'фунт', name: 'GBP - United Kingdom (£)', iso: 'GBP', rate: 1.0, symbol: '£' },
      { currency: 'иена', name: 'JPY - Japan (¥)', iso: 'JPY', rate: 1.0, symbol: '¥' },
      { currency: 'юань', name: 'CNY - China (¥)', iso: 'CNY', rate: 1.0, symbol: '¥' },
    ];

    for (const cur of defaults) {
      await prisma.currency.upsert({
        where: { currency: cur.currency },
        update: {},
        create: cur
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/currencies/rates/:iso", authenticateToken, async (req: any, res) => {
  try {
    const { iso } = req.params;
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/10e51cc83f012c14085c363d/latest/${iso}`);
    res.json(response.data);
  } catch (error: any) {
    console.error("Error proxying currency rates:", error.message);
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
});

// Balance History
app.get("/api/balance-history", authenticateToken, async (req: any, res) => {
  try {
    const history = await prisma.balanceHistory.findMany({
      where: { userId: req.user.userId },
      orderBy: { month: 'desc' }
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/balance-history", authenticateToken, async (req: any, res) => {
  try {
    const { month, totalBalance } = req.body;
    const history = await prisma.balanceHistory.upsert({
      where: { userId_month: { userId: req.user.userId, month } },
      update: { totalBalance: Number(totalBalance) },
      create: { userId: req.user.userId, month, totalBalance: Number(totalBalance) }
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/balance-history/:id", authenticateToken, async (req: any, res) => {
  try {
    const { month, totalBalance } = req.body;
    const history = await prisma.balanceHistory.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: { month, totalBalance: Number(totalBalance) }
    });
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/balance-history/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.balanceHistory.delete({
      where: { id: req.params.id, userId: req.user.userId }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clear Data
app.delete("/api/data/clear", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.category.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.planGrid.deleteMany({ where: { userId } }),
    ]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/data/clear-transactions", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.account.updateMany({
        where: { userId },
        data: { balance: 0 }
      }),
    ]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- IMPORT ROUTES ---

app.post("/api/import/batch", authenticateToken, async (req: any, res) => {
  try {
    const { accounts, categories, transactions, goals } = req.body;
    const userId = req.user.userId;

    const createdAccounts: Record<string, string> = {};
    const createdCategories: Record<string, string> = {};
    const createdGoals: Record<string, string> = {};

    // Fetch existing accounts for validation
    const existingAccounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const validAccountIds = new Set(existingAccounts.map(a => a.id));

    // 1. Import Accounts
    if (accounts && accounts.length > 0) {
      for (const acc of accounts) {
        const { id, uid, currencyUid, ...data } = acc;
        
        // Handle currency
        let currencyCode = 'RUB';
        if (currencyUid === 'RUB_RUB') currencyCode = 'RUB';
        else if (currencyUid === 'RUB_USD') currencyCode = 'USD';
        else if (acc.currency) currencyCode = acc.currency;

        // Ensure currency exists
        await prisma.currency.upsert({
          where: { currency: currencyCode },
          update: {},
          create: { currency: currencyCode, name: currencyCode === 'RUB' ? 'Рубль' : 'Доллар', iso: currencyCode }
        });

        // Ensure account exists or update it
        const created = await prisma.account.upsert({
          where: { id: id },
          update: { ...data, uid: String(uid || id), userId, currency: currencyCode },
          create: { ...data, id: id, uid: String(uid || id), userId, currency: currencyCode }
        });
        if (id) createdAccounts[String(id)] = created.id;
        validAccountIds.add(created.id);
      }
    }

    // 2. Import Categories
    if (categories && categories.length > 0) {
      const iconMap: Record<string, string> = {
        'железяки': '🛠️', 'кухня': '🛠️', 'мебель и уют': '🛠️', 'мелочной товар': '🛠️', 'ремонт': '🛠️', 'техника': '🛠️', 'туалетные принадлежности': '🛠️',
        'друг и другое на работе': '🎁',
        'Другая': '✏️',
        'Аксесуары, линзы': '🏥', 'зубы': '🏥', 'йога': '🏥', 'лекарства': '🏥', 'медицина': '🏥', 'прием врача': '🏥', 'суставы и глаза': '🏥',
        'аксессуары': '✨', 'косметика': '✨', 'макияж': '✨', 'услуги': '✨',
        'Кино': '🎭', 'Книга': '🎭', 'Музыка': '🎭', 'приложение': '🎭', 'театр': '🎭', 'цирк': '🎭', 'экскурсии': '🎭',
        'мода': '👕', 'обувь': '👕', 'Одежда': '👕', 'Прачечная': '👕', 'Украшения и девайсы': '👕',
        'госпоборы': '💰', 'интернет и сервисы': '💰', 'кв плата': '💰', 'проценты': '💰', 'связь и и-нет и сервисы': '💰', 'страховки': '💰',
        'в школе': '🛒', 'животным': '🛒', 'кофе/напитки': '🛒', 'обеды/ужины': '🛒', 'поход в магазин': '🛒', 'Рестораны/ кафе/напитки': '🛒',
        'братство': '🎮', 'кино, театр, цирк': '🎮', 'Отдых и аксесуары': '🎮', 'Подарки и праздник': '🎮', 'Пробухано': '🎮',
        'Игры': '🎓', 'музыка': '🎓', 'образование': '🎓', 'Спорт': '🎓', 'финансы': '🎓', 'хобби': '🎓',
        'авто / бензин': '✈️', 'Автобус, жд': '✈️', 'Вело': '✈️', 'запчасти и ремонт': '✈️', 'Метро': '✈️', 'мойка и др, обслуживающие': '✈️', 'страховка или штрафы': '✈️', 'Tакси': '✈️',
        'дачные ништяки': '🛠️', 'материалы для ремонтов': '🛠️', 'материалы и работы': '🛠️', 'растения и садоводство': '🛠️', 'техника и инструменты': '🛠️',
        'академия': '📚', 'обучение': '📚', 'поборы': '📚', 'учебники': '📚', 'Школьные принадлежности': '📚',
        'халтура': '🔨',
        'Бонус': '💳',
        'Др.': '💡',
        'Зарплата': '💰',
        'Карманные деньги': '🍿',
        'Такси': '🚕',
        'Халтура': '💻'
      };

      for (const cat of categories) {
        const { id, parentId, ...data } = cat;
        
        // Apply icon if not already set
        if (!data.icon) {
          const icon = iconMap[data.name];
          if (icon) {
            data.icon = icon;
          }
        }

        const created = await prisma.category.upsert({
          where: { id: id },
          update: { 
            ...data, 
            userId,
            parentId: parentId && createdCategories[parentId] ? createdCategories[parentId] : null
          },
          create: { 
            ...data, 
            id: id,
            userId,
            parentId: parentId && createdCategories[parentId] ? createdCategories[parentId] : null
          }
        });
        if (id) createdCategories[id] = created.id;
      }
    }

    // 3. Import Goals
    if (goals && goals.length > 0) {
      for (const goal of goals) {
        const { id, deadline, ...data } = goal;
        const created = await prisma.goal.upsert({
          where: { id: id },
          update: { 
            ...data,
            deadline: deadline ? new Date(deadline) : null,
            userId
          },
          create: { 
            ...data,
            id: id,
            deadline: deadline ? new Date(deadline) : null,
            userId
          }
        });
        if (id) createdGoals[id] = created.id;
      }
    }

    // 4. Import Transactions
    if (transactions && transactions.length > 0) {
      for (const trans of transactions) {
        const { accountId, targetAccountId, categoryId, subcategoryId, amount, createdAt, ...data } = trans;
        
        // Map IDs if they were provided in the import
        let mappedAccountId = createdAccounts[accountId] || accountId;
        let mappedTargetAccountId = targetAccountId ? (createdAccounts[targetAccountId] || targetAccountId) : null;
        const mappedCategoryId = categoryId ? (createdCategories[categoryId] || categoryId) : null;
        const mappedSubcategoryId = subcategoryId ? (createdCategories[subcategoryId] || subcategoryId) : null;

        // Validate account IDs, try to find by name if not found
        if (!validAccountIds.has(mappedAccountId)) {
          const accountFromImport = accounts.find((a: any) => a.id === accountId);
          if (accountFromImport) {
            const existingAccount = await prisma.account.findFirst({ where: { userId, name: accountFromImport.name } });
            if (existingAccount) {
              mappedAccountId = existingAccount.id;
              validAccountIds.add(mappedAccountId); // Add to valid set
            }
          }
        }
        if (mappedTargetAccountId && !validAccountIds.has(mappedTargetAccountId)) {
          const accountFromImport = accounts.find((a: any) => a.id === targetAccountId);
          if (accountFromImport) {
            const existingAccount = await prisma.account.findFirst({ where: { userId, name: accountFromImport.name } });
            if (existingAccount) {
              mappedTargetAccountId = existingAccount.id;
              validAccountIds.add(mappedTargetAccountId); // Add to valid set
            }
          }
        }

        if (!validAccountIds.has(mappedAccountId)) {
          console.error(`Account ID ${mappedAccountId} not found. Skipping transaction.`);
          continue;
        }
        if (mappedTargetAccountId && !validAccountIds.has(mappedTargetAccountId)) {
          console.error(`Target Account ID ${mappedTargetAccountId} not found. Skipping transaction.`);
          continue;
        }

        const { id, ...transactionData } = {
          ...data,
          userId,
          accountId: mappedAccountId,
          targetAccountId: mappedTargetAccountId,
          categoryId: mappedCategoryId,
          subcategoryId: mappedSubcategoryId,
          amount: Number(amount),
          createdAt: createdAt ? new Date(createdAt) : new Date()
        };

        if (id) {
          await prisma.transaction.upsert({
            where: { id: id },
            update: transactionData,
            create: { id: id, ...transactionData }
          });
        } else {
          await prisma.transaction.create({
            data: transactionData
          });
        }

        // Update balances
        if (data.type === 'expense') {
          await prisma.account.update({
            where: { id: mappedAccountId },
            data: { balance: { decrement: Number(amount) } }
          });
        } else if (data.type === 'income') {
          await prisma.account.update({
            where: { id: mappedAccountId },
            data: { balance: { increment: Number(amount) } }
          });
        } else if (data.type === 'transfer' && mappedTargetAccountId) {
          await prisma.account.update({
            where: { id: mappedAccountId },
            data: { balance: { decrement: Number(amount) } }
          });
          await prisma.account.update({
            where: { id: mappedTargetAccountId },
            data: { balance: { increment: Number(amount) } }
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Batch Import Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- VITE MIDDLEWARE ---

// Chat History
app.get("/api/chat-history", authenticateToken, async (req: any, res) => {
  try {
    const history = await prisma.chatMessage.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "asc" },
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

app.post("/api/chat-history", authenticateToken, async (req: any, res) => {
  try {
    const { role, content, type, actionType, actionData } = req.body;
    const message = await prisma.chatMessage.create({
      data: {
        userId: req.user.userId,
        role,
        content,
        type,
        actionType,
        actionData: actionData ? JSON.stringify(actionData) : null,
      },
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to save message" });
  }
});

app.put("/api/chat-history/:id", authenticateToken, async (req: any, res) => {
  try {
    const { content, type } = req.body;
    const message = await prisma.chatMessage.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: { content, type },
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to update message" });
  }
});

app.delete("/api/chat-history", authenticateToken, async (req: any, res) => {
  try {
    await prisma.chatMessage.deleteMany({
      where: { userId: req.user.userId },
    });
    res.json({ message: "Chat history cleared" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear chat history" });
  }
});

app.delete("/api/chat-history/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.chatMessage.delete({
      where: { id: req.params.id, userId: req.user.userId },
    });
    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// AI Logs
app.get("/api/ai-logs", authenticateToken, async (req: any, res) => {
  try {
    const logs = await prisma.aiLog.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    console.error("Fetch AI Logs Error:", error);
    res.status(500).json({ error: "Failed to fetch AI logs" });
  }
});

app.post("/api/ai-logs", authenticateToken, async (req: any, res) => {
  try {
    const { request: aiRequest, response: aiResponse, provider } = req.body;
    
    const log = await prisma.aiLog.create({
      data: {
        userId: req.user.userId,
        request: aiRequest || {},
        response: aiResponse || {},
        provider: provider || "gemini",
      },
    });

    // Cleanup old logs (keep last 100)
    try {
      const count = await prisma.aiLog.count({ where: { userId: req.user.userId } });
      if (count > 100) {
        const oldest = await prisma.aiLog.findMany({
          where: { userId: req.user.userId },
          orderBy: { createdAt: "asc" },
          take: count - 100,
        });
        await prisma.aiLog.deleteMany({
          where: { id: { in: oldest.map(l => l.id) } },
        });
      }
    } catch (cleanupError) {
      console.error("AI Log Cleanup Error:", cleanupError);
      // Don't fail the request if cleanup fails
    }

    res.json(log);
  } catch (error) {
    console.error("AI Log Save Error:", error);
    res.status(500).json({ error: "Failed to save AI log" });
  }
});

// AI Proxy Routes
app.post("/api/ai/deepseek", authenticateToken, async (req: any, res) => {
  try {
    const { systemInstruction, userPrompt, responseFormat } = req.body;
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

    if (!DEEPSEEK_API_KEY) {
      console.error("DEEPSEEK_API_KEY is missing in server environment");
      return res.status(500).json({ error: "DeepSeek API key is not configured on the server." });
    }

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt }
        ],
        response_format: responseFormat ? { type: responseFormat } : undefined,
        temperature: 0.7
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        }
      }
    );

    res.json({ content: response.data.choices[0].message.content });
  } catch (error: any) {
    console.error("DeepSeek Proxy Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: "Failed to call DeepSeek API",
      details: error.response?.data || error.message
    });
  }
});

// Socket.io connection logic
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join", (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const notifyUser = (userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};

async function startServer() {
  // Catch-all for API routes to avoid falling through to SPA fallback
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
