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

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET_VALUE);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      console.warn(`[Auth] User not found during token verification: ${decoded.userId}`);
      return res.status(401).json({ error: "User not found" });
    }

    req.user = { userId: user.id, email: user.email, role: user.role };
    next();
  } catch (err: any) {
    console.error(`[Auth] Token verification failed: ${err.message}`);
    return res.status(403).json({ error: "Forbidden" });
  }
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: "Admin role required" });
  }
};
