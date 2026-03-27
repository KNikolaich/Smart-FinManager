import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, settings: user.settings } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email, settings: user.settings });
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
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/accounts/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id, userId: req.user.userId } });
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
    const category = await prisma.category.create({
      data: { ...req.body, userId: req.user.userId },
    });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/categories/:id", authenticateToken, async (req: any, res) => {
  try {
    const category = await prisma.category.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: req.body,
    });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/categories/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id, userId: req.user.userId } });
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
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/goals/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.goal.delete({ where: { id: req.params.id, userId: req.user.userId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Budgets
app.get("/api/budgets", authenticateToken, async (req: any, res) => {
  try {
    const budgets = await prisma.budget.findMany({ where: { userId: req.user.userId } });
    res.json(budgets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/budgets", authenticateToken, async (req: any, res) => {
  try {
    const { amount, spent, ...rest } = req.body;
    const budget = await prisma.budget.create({
      data: { 
        ...rest, 
        amount: Number(amount),
        spent: Number(spent || 0),
        userId: req.user.userId 
      },
    });
    res.json(budget);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/budgets/:id", authenticateToken, async (req: any, res) => {
  try {
    const { amount, spent, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (amount !== undefined) updateData.amount = Number(amount);
    if (spent !== undefined) updateData.spent = Number(spent);

    const budget = await prisma.budget.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: updateData,
    });
    res.json(budget);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/budgets/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.budget.delete({ where: { id: req.params.id, userId: req.user.userId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Plans
app.get("/api/plans", authenticateToken, async (req: any, res) => {
  try {
    const plans = await prisma.plan.findMany({ where: { userId: req.user.userId } });
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/plans", authenticateToken, async (req: any, res) => {
  try {
    const { plannedAmount, dateOfFinish, ...rest } = req.body;
    const plan = await prisma.plan.create({
      data: { 
        ...rest, 
        plannedAmount: Number(plannedAmount),
        dateOfFinish: new Date(dateOfFinish),
        userId: req.user.userId 
      },
    });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/plans/:id", authenticateToken, async (req: any, res) => {
  try {
    const { plannedAmount, dateOfFinish, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (plannedAmount !== undefined) updateData.plannedAmount = Number(plannedAmount);
    if (dateOfFinish !== undefined) updateData.dateOfFinish = new Date(dateOfFinish);

    const plan = await prisma.plan.update({
      where: { id: req.params.id, userId: req.user.userId },
      data: updateData,
    });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/plans/:id", authenticateToken, async (req: any, res) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id, userId: req.user.userId } });
    res.json({ success: true });
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

app.post("/api/currencies/seed", authenticateToken, async (req: any, res) => {
  try {
    const defaults = [
      { curUid: 'RUB', name: 'RUB - Russia (руб)', iso: 'RUB' },
      { curUid: 'USD', name: 'USD - USA (US$)', iso: 'USD' },
      { curUid: 'EUR', name: 'EUR - European Union (€)', iso: 'EUR' },
      { curUid: 'GBP', name: 'GBP - United Kingdom (£)', iso: 'GBP' },
      { curUid: 'JPY', name: 'JPY - Japan (¥)', iso: 'JPY' },
      { curUid: 'CNY', name: 'CNY - China (¥)', iso: 'CNY' },
    ];

    for (const cur of defaults) {
      await prisma.currency.upsert({
        where: { curUid: cur.curUid },
        update: {},
        create: cur,
      });
    }
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
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.plan.deleteMany({ where: { userId } }),
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
    console.log(`Saving AI log for user ${req.user.userId}, provider: ${provider}`);
    
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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
