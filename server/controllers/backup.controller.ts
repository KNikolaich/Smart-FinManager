import * as backupService from "../services/backup.service";
import { BackupServiceError } from "../services/backup.service";

function handleError(res: any, error: unknown) {
  const statusCode = error instanceof BackupServiceError ? error.statusCode : 500;
  if (statusCode >= 500) console.error("Backup request failed:", error);
  return res.status(statusCode).json({
    error: error instanceof Error ? error.message : "Ошибка резервного копирования",
  });
}

export async function exportUser(req: any, res: any) {
  try {
    res.json(await backupService.exportBackup(req.user.userId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function restoreUser(req: any, res: any) {
  try {
    res.json(await backupService.restoreBackup(req.user.userId, req.body, false));
  } catch (error) {
    handleError(res, error);
  }
}

export async function exportAdmin(req: any, res: any) {
  try {
    res.json(await backupService.exportBackup(req.user.userId, true));
  } catch (error) {
    handleError(res, error);
  }
}

export async function restoreAdmin(req: any, res: any) {
  try {
    res.json(await backupService.restoreBackup(req.user.userId, req.body, true));
  } catch (error) {
    handleError(res, error);
  }
}