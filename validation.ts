import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Express middleware factory: validates req.body against a Zod schema.
 * On success, req.body is REPLACED with the parsed/whitelisted data (so any
 * extra/forbidden fields sent by the client are stripped, not just ignored).
 * On failure, responds 400 with a concise validation error message.
 */
export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

// --- Shared primitives ---
const idString = z.string().min(1).max(191);
const dateInput = z.union([z.string(), z.date()]).transform((v) => new Date(v)).refine((d) => !isNaN(d.getTime()), { message: "Invalid date" });
const optionalNullableDate = z.union([dateInput, z.null()]).optional();

// --- Auth ---
export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1).max(200),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().max(120).optional().nullable(),
  photoURL: z.string().trim().max(2048).optional().nullable(),
}).strict();

// --- Accounts ---
export const accountCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(60),
  balance: z.number().finite().optional().default(0),
  currency: z.string().trim().min(1).max(20).optional().default("RUB"),
  currencyId: idString.optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  showOnDashboard: z.boolean().optional().default(true),
  showInTotals: z.boolean().optional().default(true),
  isArchived: z.boolean().optional().default(false),
  color: z.string().trim().max(30).optional().nullable(),
}).strict();

export const accountUpdateSchema = accountCreateSchema.partial().strict();

// --- Categories ---
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(60),
  icon: z.string().trim().min(1).max(30),
  color: z.string().trim().min(1).max(30),
  parentId: idString.optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
}).strict();

export const categoryUpdateSchema = categoryCreateSchema.partial().strict();

// --- Transactions ---
const transactionTypeEnum = z.enum(["income", "expense", "transfer"]);

export const transactionCreateSchema = z.object({
  accountId: idString,
  targetAccountId: idString.optional().nullable(),
  amount: z.coerce.number().finite(),
  type: transactionTypeEnum,
  categoryId: idString.optional().nullable(),
  subcategoryId: idString.optional().nullable(),
  description: z.string().trim().max(500).optional().default(""),
  createdAt: optionalNullableDate,
}).strict();

export const transactionUpdateSchema = transactionCreateSchema.strict();

// --- Goals ---
export const goalCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  targetAmount: z.coerce.number().finite(),
  currentAmount: z.coerce.number().finite().optional().default(0),
  deadline: optionalNullableDate,
  isCompleted: z.boolean().optional(),
  completedAt: optionalNullableDate,
  sortOrder: z.number().int().optional().nullable(),
}).strict();

export const goalUpdateSchema = goalCreateSchema.partial().strict();

// --- Plan Grid ---
// Free-form JSON payloads keyed by plan type. The shape genuinely varies by
// `type`, so we allow arbitrary keys but explicitly forbid server-controlled
// / cross-cutting field names from sneaking into the stored JSON blob.
const forbiddenPlanGridKeys = ["id", "userId", "createdAt", "updatedAt", "role"] as const;
function rejectForbiddenKeys(data: Record<string, unknown>, ctx: z.RefinementCtx) {
  for (const key of forbiddenPlanGridKeys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field '${key}' is not allowed`,
        path: [key],
      });
    }
  }
}

export const planGridDataSchema = z
  .record(z.string(), z.any())
  .superRefine(rejectForbiddenKeys);

export const planGridBulkSchema = z
  .object({
    config: z.any().optional(),
    cashback: z.any().optional(),
    comment: z.any().optional(),
    subjects: z.any().optional(),
    rows: z.any().optional(),
    pastRows: z.any().optional(),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

// --- Currencies ---
export const currencyCreateSchema = z.object({
  currency: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  iso: z.string().trim().min(1).max(10),
  rate: z.number().finite().optional().default(1.0),
  symbol: z.string().trim().max(10).optional().nullable(),
}).strict();

export const currencyUpdateSchema = currencyCreateSchema.partial().strict();

// --- Balance History ---
export const balanceHistoryCreateSchema = z.object({
  month: z.string().trim().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
  totalBalance: z.coerce.number().finite(),
}).strict();

export const balanceHistoryUpdateSchema = balanceHistoryCreateSchema.strict();

// --- Chat Messages ---
export const chatMessageCreateSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(20000),
  type: z.string().trim().max(60).optional().nullable(),
  actionType: z.string().trim().max(60).optional().nullable(),
  actionData: z.any().optional().nullable(),
  attachments: z.any().optional().nullable(),
}).strict();

export const chatMessageUpdateSchema = z.object({
  content: z.string().max(20000).optional(),
  type: z.string().trim().max(60).optional().nullable(),
}).strict();

// --- AI Logs ---
export const aiLogCreateSchema = z.object({
  request: z.any().optional().default({}),
  response: z.any().optional().default({}),
  provider: z.string().trim().max(60).optional().default("gemini"),
}).strict();
