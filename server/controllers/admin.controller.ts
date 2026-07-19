import { spawn } from "child_process";
import { prisma } from "../prisma";
import * as adminService from "../services/admin.service";

/**
 * Splits compound ALTER TABLE statements that PostgreSQL rejects when they mix
 * RENAME CONSTRAINT with TYPE-change clauses in a single statement.
 *
 * E.g. Prisma may generate:
 *   ALTER TABLE "t" RENAME CONSTRAINT "old_pkey" TO "new_pkey",
 *                   ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
 *
 * PostgreSQL requires those to be separate statements:
 *   ALTER TABLE "t" RENAME CONSTRAINT "old_pkey" TO "new_pkey";
 *   ALTER TABLE "t" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
 */
function splitCompoundAlterTable(sql: string): string[] {
  const out: string[] = [];

  // Naive but sufficient: split on ; then handle each statement.
  const stmts = sql
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const stmt of stmts) {
    // Match: ALTER TABLE <name> <rest>
    const m = stmt.match(/^(ALTER\s+TABLE\s+"?[\w\d_]+"?)\s+([\s\S]+)$/i);
    if (!m) {
      out.push(stmt + ";");
      continue;
    }

    const prefix = m[1]; // "ALTER TABLE "tbl_name""
    const body = m[2];   // everything after table name

    // Detect RENAME CONSTRAINT ... TO ..., followed by more clauses
    const renameRe =
      /^(RENAME\s+CONSTRAINT\s+"?[\w\d_]+"?\s+TO\s+"?[\w\d_]+"?)\s*,\s*([\s\S]+)$/i;
    const rm = body.match(renameRe);

    if (rm) {
      // Split into two standalone ALTER TABLE statements
      out.push(`${prefix} ${rm[1].trim()};`);
      out.push(`${prefix} ${rm[2].trim().replace(/;$/, "")};`);
    } else {
      out.push(stmt + ";");
    }
  }

  return out;
}

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

async function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; text: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env }, timeout: 120_000 });
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    child.stdout.on("data", (d: Buffer) => outChunks.push(d.toString()));
    child.stderr.on("data", (d: Buffer) => errChunks.push(d.toString()));
    child.on("close", (code: number | null) => {
      const stdout = outChunks.join("");
      const stderr = errChunks.join("");
      resolve({ stdout, stderr, text: stdout + stderr, exitCode: code ?? 1 });
    });
    child.on("error", (err: Error) => resolve({ stdout: "", stderr: `Spawn error: ${err.message}`, text: `Spawn error: ${err.message}`, exitCode: 1 }));
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
    const inSync = result.exitCode === 0 && result.stdout.trim() === "-- This is an empty migration.";
    res.json({ inSync, output: result.stdout || result.stderr, exitCode: result.exitCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function migrateDb(req: any, res: any) {
  try {
    // Step 1 — get the SQL diff between current DB state and schema.
    // We intentionally avoid "prisma db push" here because it generates compound
    // ALTER TABLE statements (RENAME CONSTRAINT + ALTER COLUMN in one shot) that
    // certain PostgreSQL server versions reject with a syntax error.
    const diffResult = await runCommand("npx", [
      "prisma", "migrate", "diff",
      "--from-url", process.env.DATABASE_URL!,
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--script",
    ]);

    if (diffResult.exitCode !== 0) {
      return res.json({
        success: false,
        alreadyInSync: false,
        output: `Ошибка при получении diff схемы:\n${diffResult.stderr || diffResult.stdout}`,
        exitCode: diffResult.exitCode,
      });
    }

    const EMPTY = "-- This is an empty migration.";
    if (diffResult.stdout.trim() === EMPTY) {
      return res.json({
        success: true,
        alreadyInSync: true,
        output: "✅ База данных уже синхронизирована. Изменений не требуется.",
        exitCode: 0,
      });
    }

    // Step 2 — split any compound ALTER TABLE statements that mix RENAME CONSTRAINT
    // with ALTER COLUMN TYPE, then execute each statement separately.
    // Use only stdout — stderr contains npm notices, not SQL.
    const statements = splitCompoundAlterTable(diffResult.stdout);
    const log: string[] = [`Применяю ${statements.length} SQL-операцию(й):\n`];
    const errors: string[] = [];

    for (const stmt of statements) {
      log.push(`▶ ${stmt}`);
      try {
        await prisma.$executeRawUnsafe(stmt);
        log.push(`  ✅ OK\n`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        log.push(`  ❌ ${msg}\n`);
        errors.push(msg);
      }
    }

    // Step 3 — re-check to confirm sync.
    const recheckResult = await runCommand("npx", [
      "prisma", "migrate", "diff",
      "--from-url", process.env.DATABASE_URL!,
      "--to-schema-datamodel", "prisma/schema.prisma",
      "--script",
    ]);
    const nowInSync =
      recheckResult.exitCode === 0 && recheckResult.text.trim() === EMPTY;

    if (nowInSync) {
      log.push("✅ Схема БД полностью синхронизирована.");
    } else {
      log.push("⚠️ После применения всё ещё есть расхождения — возможно, требуется повторный запуск.");
    }

    res.json({
      success: nowInSync && errors.length === 0,
      alreadyInSync: false,
      syncedDespiteError: nowInSync && errors.length > 0,
      output: log.join("\n"),
      exitCode: errors.length === 0 ? 0 : 1,
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
