import * as authService from "../services/auth.service";

export async function register(req: any, res: any) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await authService.registerUser(email, password);
    res.json(result);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
}

export async function login(req: any, res: any) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const result = await authService.loginUser(email, password);
    res.json(result);
  } catch (error: any) {
    console.error("Login Error:", error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.message.includes("could not write init file") || error.message.includes("Error querying the database")) {
      return res.status(503).json({
        error: "Database server error. This usually means the database server is out of disk space or has permission issues. Please check your DB server (FATAL: could not write init file)."
      });
    }
    res.status(500).json({ error: error.message });
  }
}

export async function getInitialData(req: any, res: any) {
  try {
    const data = await authService.getInitialData(req.user.userId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getMe(req: any, res: any) {
  try {
    const me = await authService.getMe(req.user.userId);
    if (!me) return res.status(401).json({ error: "User not found" });
    res.json(me);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateMe(req: any, res: any) {
  try {
    const { displayName, photoURL } = req.body;
    const result = await authService.updateMe(req.user.userId, displayName, photoURL);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function verifyPassword(req: any, res: any) {
  try {
    const { password } = req.body;
    const valid = await authService.verifyPassword(req.user.userId, password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid password" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function forgotPassword(req: any, res: any) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const result = await authService.forgotPassword(email);
    res.json(result);
  } catch (error: any) {
    console.error("Forgot Password Error:", error);
    res.json(authService.GENERIC_FORGOT_PASSWORD_RESPONSE);
  }
}
