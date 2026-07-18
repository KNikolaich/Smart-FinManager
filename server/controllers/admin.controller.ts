import { spawn } from "child_process";
import * as adminService from "../services/admin.service";

export async function listUsers(req: any, res: any) {
  try {
    const users = await adminService.listUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteUser(req: any, res: any) {
  try {
    await adminService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function unlockUser(req: any, res: any) {
  try {
    await adminService.unlockUser(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Unlock user error:", error);
    res.status(500).json({ error: error.message });
  }
}

async function runCommand(cmd: string, args: string[]): Promise<{ text: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env }, timeout: 120_000 });
    const chunks: string[] = [];
    child.stdout.on("data", (d: Buffer) => chunks.push(d.toString()));
    child.stderr.on("data", (d: Buffer) => chunks.push(d.toString()));
    child.on("close", (code: number | null) => resolve({ text: chunks.join(""), exitCode: code ?? 1 }));
    child.on("error", (err: Error) => resolve({ text: `Spawn error: ${err.message}`, exitCode: 1 }));
  });
}

export async function dbStatus(req: any, res: any) {
  try {
    const result = await runCommand("npx", [
      "prisma", "migrate", "diff",
      "--from-url", process.env.DATABASE_URL!,
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--script",
    ]);
    const inSync = result.exitCode === 0 && result.text.trim() === "-- This is an empty migration.";
    res.json({ inSync, output: result.text, exitCode: result.exitCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function migrateDb(req: any, res: any) {
  const acceptDataLoss = req.body?.acceptDataLoss === true;

  try {
    // First check if the DB is already in sync
    const statusResult = await runCommand("npx", [
      "prisma", "migrate", "diff",
      "--from-url", process.env.DATABASE_URL!,
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--script",
    ]);
    const alreadyInSync = statusResult.exitCode === 0 && statusResult.text.trim() === "-- This is an empty migration.";

    if (alreadyInSync) {
      return res.json({
        success: true,
        alreadyInSync: true,
        output: "✅ База данных уже синхронизирована. Изменений не требуется.",
        exitCode: 0,
      });
    }

    const args = ["prisma", "db", "push", "--skip-generate"];
    if (acceptDataLoss) args.push("--accept-data-loss");

    const pushResult = await runCommand("npx", args);

    // Even if push errored, recheck sync status — some PG versions reject
    // constraint-rename SQL but still apply the structural changes correctly.
    const recheckResult = await runCommand("npx", [
      "prisma", "migrate", "diff",
      "--from-url", process.env.DATABASE_URL!,
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--script",
    ]);
    const nowInSync = recheckResult.exitCode === 0 && recheckResult.text.trim() === "-- This is an empty migration.";

    res.json({
      success: nowInSync,
      alreadyInSync: false,
      output: pushResult.text,
      exitCode: pushResult.exitCode,
      // If push "failed" but DB is now in sync, flag it so UI can show a softer message
      syncedDespiteError: pushResult.exitCode !== 0 && nowInSync,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function sendUserPassword(req: any, res: any) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
      await adminService.sendUserPassword(req.params.id, email);
      res.json({ success: true, message: "Password sent successfully" });
    } catch (mailError: any) {
      if (mailError.status === 404) {
        return res.status(404).json({ error: mailError.message });
      }
      console.error("Mail delivery error (Admin):", mailError);
      let errorMsg = "Ошибка при отправке письма.";
      if (mailError.message.includes("Application-specific password required")) {
        errorMsg = "Ошибка SMTP: Требуется пароль приложения. Пожалуйста, создайте App Password в настройках Google.";
      } else if (mailError.message.includes("Invalid login")) {
        errorMsg = "Ошибка SMTP: Неверный логин или пароль для почтового сервера.";
      }
      res.status(500).json({ error: errorMsg });
    }
  } catch (error: any) {
    console.error("Send password error:", error);
    res.status(500).json({ error: error.message });
  }
}
