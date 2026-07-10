import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createHttpServer } from "http";

import { PORT } from "./server/config";
import { prisma } from "./server/prisma";
import { initSocket } from "./server/socket";
import { ensureAdminExists } from "./server/services/admin.service";

import authRoutes from "./server/routes/auth.routes";
import accountsRoutes from "./server/routes/accounts.routes";
import categoriesRoutes from "./server/routes/categories.routes";
import transactionsRoutes from "./server/routes/transactions.routes";
import goalsRoutes from "./server/routes/goals.routes";
import planGridsRoutes from "./server/routes/planGrids.routes";
import currenciesRoutes from "./server/routes/currencies.routes";
import balanceHistoryRoutes from "./server/routes/balanceHistory.routes";
import userRoutes from "./server/routes/user.routes";
import importRoutes from "./server/routes/import.routes";
import chatHistoryRoutes from "./server/routes/chatHistory.routes";
import aiLogsRoutes from "./server/routes/aiLogs.routes";
import aiProxyRoutes from "./server/routes/aiProxy.routes";
import adminRoutes from "./server/routes/admin.routes";

const app = express();
const httpServer = createHttpServer(app);
initSocket(httpServer);

// Trust only the first hop proxy (Replit's proxy) so req.ip reflects the
// real client IP from X-Forwarded-For without allowing spoofing from
// further down an arbitrary chain.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.path}`);
  }
  next();
});

// --- AUTH ROUTES ---
app.use(authRoutes);

// --- DATA ROUTES ---
app.use(accountsRoutes);
app.use(categoriesRoutes);
app.use(transactionsRoutes);
app.use(goalsRoutes);
app.use(planGridsRoutes);
app.use(currenciesRoutes);
app.use(balanceHistoryRoutes);
app.use(userRoutes);

// --- IMPORT ROUTES ---
app.use(importRoutes);

app.use(chatHistoryRoutes);
app.use(aiLogsRoutes);
app.use(aiProxyRoutes);

async function startServer() {
  // Ensure at least one admin exists if users exist
  await ensureAdminExists();

  // --- ADMIN ROUTES ---
  app.use(adminRoutes);

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
    const distPath = path.join(process.cwd(), 'build');
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
