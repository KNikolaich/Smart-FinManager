import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { encrypt, decrypt } from "../crypto";
import { JWT_SECRET_VALUE } from "../config";
import { transporter } from "../mailer";
import { isAccountLockedOut, recordAccountLoginFailure, resetAccountLoginFailures, ACCOUNT_WARNING_THRESHOLD } from "../rateLimitStore";

async function maybeSendAttackWarningEmail(email: string, attempts: number) {
  if (attempts !== ACCOUNT_WARNING_THRESHOLD) return; // fire once per lockout window

  try {
    const hasSMTP = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (!hasSMTP) {
      console.log(`[Auth] STUB: would warn ${email} about ${attempts} repeated failed login attempts (SMTP not configured)`);
      return;
    }
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Finance App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Подозрительная активность: вход в ваш аккаунт",
      text: `Здравствуйте! Мы зафиксировали ${attempts} неудачных попыток входа в ваш аккаунт за последние 15 минут. Если это были не вы, рекомендуем сменить пароль. Если попытки продолжатся, доступ к аккаунту будет временно заблокирован.`,
      html: `<p>Здравствуйте!</p><p>Мы зафиксировали <b>${attempts}</b> неудачных попыток входа в ваш аккаунт за последние 15 минут.</p><p>Если это были не вы, рекомендуем сменить пароль. Если попытки продолжатся, доступ к аккаунту будет временно заблокирован.</p>`,
    });
    console.log(`[Auth] Sent repeated-failed-login warning to ${email}`);
  } catch (mailError) {
    console.error("Failed to send login-attack warning email:", mailError);
  }
}

export async function registerUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(password, 10);
  const encryptedPass = encrypt(password);

  // Make the first user an admin
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? 'admin' : 'user';

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      encryptedPassword: encryptedPass,
      role
    },
  });
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET_VALUE);
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  console.log(`[Auth] Login attempt for: ${normalizedEmail}`);

  // Per-account lockout: tracks failed attempts by account regardless of
  // requester IP, so rotating IPs can't be used to bypass the IP-based
  // limiter above.
  if (await isAccountLockedOut(prisma, normalizedEmail)) {
    console.warn(`[Auth] Login blocked: account temporarily locked out (${normalizedEmail})`);
    const err: any = new Error("Too many failed attempts for this account. Please try again later.");
    err.status = 429;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    console.warn(`[Auth] Login failed: User not found (${normalizedEmail})`);
    // No registered account to warn — nothing further to do here.
    await recordAccountLoginFailure(prisma, normalizedEmail);
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    console.warn(`[Auth] Login failed: Password mismatch for ${normalizedEmail}`);
    const attempts = await recordAccountLoginFailure(prisma, normalizedEmail);
    await maybeSendAttackWarningEmail(user.email, attempts);
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  // Successful login: clear any accumulated failure count for this account.
  await resetAccountLoginFailures(prisma, normalizedEmail);

  // Save encrypted password if it's missing (for older accounts)
  if (!user.encryptedPassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: { encryptedPassword: encrypt(password) }
    });
  }

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET_VALUE);
  return { token, user: { id: user.id, email: user.email, role: user.role, settings: user.settings } };
}

export async function getInitialData(userId: string) {
  const [accounts, transactions, goals, categories, currencies, balanceHistory] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.goal.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.currency.findMany(),
    prisma.balanceHistory.findMany({ where: { userId }, orderBy: { month: 'desc' } }),
  ]);

  return { accounts, transactions, goals, categories, currencies, balanceHistory };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

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

  return { id: user.id, email: user.email, displayName: user.displayName, photoURL: user.photoURL, role: user.role, settings: user.settings };
}

export async function updateMe(userId: string, displayName: string | null | undefined, photoURL: string | null | undefined) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { displayName, photoURL },
  });
  return { id: user.id, email: user.email, displayName: user.displayName, photoURL: user.photoURL, role: user.role, settings: user.settings };
}

export async function verifyPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return false;
  }
  return true;
}

const GENERIC_FORGOT_PASSWORD_RESPONSE = { success: true, message: "Если такой email зарегистрирован, письмо с инструкциями отправлено" };

export async function forgotPassword(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !user.encryptedPassword) {
    // Don't reveal whether the account exists or lacks a recoverable password.
    if (user && !user.encryptedPassword) {
      console.log(`[Auth] Forgot-password requested for ${normalizedEmail}, but account has no recoverable password (old account).`);
    }
    return GENERIC_FORGOT_PASSWORD_RESPONSE;
  }

  let decryptedPass: string;
  try {
    decryptedPass = decrypt(user.encryptedPassword);
  } catch (decryptError) {
    console.error("Decryption error:", decryptError);
    return GENERIC_FORGOT_PASSWORD_RESPONSE;
  }

  try {
    // If we have real SMTP credentials, send email.
    // Otherwise, just log it and simulate success for the demo.
    const hasSMTP = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    if (hasSMTP) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Finance App" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "Восстановление пароля",
        text: `Здравствуйте! Ваш пароль: ${decryptedPass}`,
        html: `<p>Здравствуйте!</p><p>Ваш пароль: <b>${decryptedPass}</b></p>`,
      });
      console.log(`[Auth] Password sent to ${user.email}`);
    } else {
      console.log(`[Auth] STUB: Password for ${user.email} is ${decryptedPass} (SMTP not configured)`);
    }

    return GENERIC_FORGOT_PASSWORD_RESPONSE;
  } catch (mailError: any) {
    console.error("Mail delivery error:", mailError);
    return GENERIC_FORGOT_PASSWORD_RESPONSE;
  }
}

export { GENERIC_FORGOT_PASSWORD_RESPONSE };
