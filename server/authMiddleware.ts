import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { JWT_SECRET_VALUE } from "./config";

// Auth Middleware
export const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn(`[Auth] Missing token for ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET_VALUE);
  } catch (err: any) {
    console.warn(`[Auth] Token rejected: ${err.name || "verification failed"}`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  let user: any;
  try {
    user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
  } catch (err: any) {
    console.error(`[Auth] User lookup failed: ${err.message}`);
    return res.status(500).json({ error: "Authentication service unavailable" });
  }

  if (!user) {
    console.warn(`[Auth] User not found during token verification: ${decoded.userId}`);
    return res.status(401).json({ error: "User not found" });
  }

  req.user = { userId: user.id, email: user.email, role: user.role };
  next();
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: "Admin role required" });
  }
};
