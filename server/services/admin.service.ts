import { prisma } from "../prisma";
import { decrypt } from "../crypto";
import { transporter } from "../mailer";

export function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
    }
  });
}

export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function sendUserPassword(id: string, email: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { encryptedPassword: true, email: true, displayName: true }
  });

  if (!targetUser) {
    const err: any = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const decryptedPassword = decrypt(targetUser.encryptedPassword);

  await transporter.sendMail({
    from: `"FinAssistant Admin" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Ваш пароль",
    text: `Здравствуйте! По запросу администратора отправляем ваши учетные данные.\n\nПользователь: ${targetUser.displayName || targetUser.email}\nПароль: ${decryptedPassword}\n\nПожалуйста, смените пароль после входа в систему.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Ваш пароль</h2>
        <p>Здравствуйте!</p>
        <p>По запросу администратора отправляем ваши учетные данные:</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Пользователь:</strong> ${targetUser.displayName || targetUser.email}</p>
          <p style="margin: 5px 0;"><strong>Пароль:</strong> <code style="font-size: 1.2em; color: #d32f2f;">${decryptedPassword}</code></p>
        </div>
        <p style="color: #666; font-size: 0.9em;">Пожалуйста, смените пароль в настройках профиля после входа в систему.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 0.8em; text-align: center;">Это автоматическое сообщение, отвечать на него не нужно.</p>
      </div>
    `
  });
}

export async function ensureAdminExists() {
  // Ensure at least one admin exists if users exist
  try {
    const adminExists = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!adminExists) {
      const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
      if (firstUser) {
        await prisma.user.update({
          where: { id: firstUser.id },
          data: { role: 'admin' }
        });
        console.log(`[Admin] Elevated user ${firstUser.email} to admin (no admin found)`);
      }
    }
  } catch (err) {
    console.warn("[Admin] Failed to check/elevate admin status:", err);
  }
}
