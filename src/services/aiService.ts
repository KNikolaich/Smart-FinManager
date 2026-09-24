import { Account, Category, Transaction, Goal, Plan, Message } from "../types";
import { api } from "../lib/api";
import axios from "axios";
import { getAICompoundActions } from "../lib/aiCompoundActions";

export interface AIResponse {
  intent: 'transaction' | 'goal' | 'plan' | 'calendar_plan' | 'calendar_note' | 'compound' | 'advice' | 'unknown';
  data: any;
  message: string;
}

const normalizeRussianRublesAmount = (text: string, amount: unknown): unknown => {
  if (typeof amount !== 'number' && typeof amount !== 'string') return amount;

  // Voice transcription often uses a dot/comma as a thousands separator:
  // "зарплата 30.015 руб" means 30 015 rubles, not 30.015 rubles.
  // Treat a three-digit group before a ruble marker as thousands unless
  // the user explicitly mentions kopeks.
  const mentionsKopeks = /\bкоп(?:ейк|еек|ейки|ейку)?\b|\bс\s+коп/i.test(text);
  if (mentionsKopeks) return amount;

  const groupedRubles = text.match(
    /(?:^|[^\d])(\d{1,3}(?:[.,\s]\d{3})+)\s*(?:₽|руб(?:\.|л(?:ь|я|ей|и)?|лей)?)/iu
  );
  if (!groupedRubles) return amount;

  const groupedValue = Number(groupedRubles[1].replace(/[.,\s]/g, ''));
  return Number.isFinite(groupedValue) && groupedValue > 0 ? groupedValue : amount;
};

const logAIInteraction = async (userId: string, request: any, response: any, provider: string = 'openai') => {
  if (!userId) {
    return;
  }
  try {
    await api.post('/ai-logs', {
      request,
      response,
      provider
    });
  } catch (error) {
    console.error('Error logging AI interaction:', error);
  }
};

const callAI = async (systemInstruction: string, userPrompt: string, responseFormat?: "json_object", imageData?: string[]) => {
  const hasImages = imageData && imageData.length > 0;
  
  if (hasImages) {
    // Stage 1: OpenAI (GPT-4o) specifically for OCR/Vision extraction
    // Since DeepSeek API doesn't support images yet, we extract the data first.
    const ocrMessages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all financial information, text, items, store names, QR data, and totals from these images. Provide it as clear text." },
          ...imageData!.map(base64 => ({
            type: "image_url" as const,
            image_url: {
              url: base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`
            }
          }))
        ]
      }
    ];

    try {
      const ocrResult = await api.post<{ content: string }>("/ai/openai", {
        systemInstruction: "You are a professional OCR assistant for financial documents.",
        messages: ocrMessages,
        model: "gpt-4o"
      });

      const extractedText = ocrResult.content;

      // Stage 2: DeepSeek-Chat for the actual business logic / recognition
      const deepseekMessages = [
        { role: "user", content: `${userPrompt}\n\n[EXTRACTED TEXT FROM IMAGES FOR LOGIC]:\n${extractedText}` }
      ];

      const response = await api.post<{ content: string }>("/ai/deepseek", {
        systemInstruction,
        messages: deepseekMessages,
        responseFormat,
        model: "deepseek-chat"
      });

      return response.content;
    } catch (error) {
      console.error("OCR + DeepSeek Error Flow:", error);
      throw error;
    }
  } else {
    // Standard text-only call via DeepSeek
    const messages = [{ role: "user", content: userPrompt }];

    const response = await api.post<{ content: string }>("/ai/deepseek", {
      systemInstruction,
      messages,
      responseFormat,
      model: "deepseek-chat"
    });
    return response.content;
  }
};

export const processUserMessage = async (
  userId: string,
  text: string, 
  accounts: Account[], 
  categories: Category[],
  imageData?: string[],
  recentTransactions?: Transaction[]
): Promise<AIResponse> => {
  const mainAccounts = accounts.filter(a => a.showOnDashboard && !a.isArchived);
  
  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  const localWeekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  const systemInstruction = `Ты — мудрый и дружелюбный финансовый ассистент, как понимающий старший товарищ. Твоя цель — помогать пользователю управлять деньгами легко и без стресса. Говори по-дружески, но конкретно.
  
  Твой тон: теплый, поддерживающий, уверенный. Ты не просто бот, ты — наставник, который уже все сделал за пользователя.
 
  IMAGE ANALYSIS:
  - If the user provides one or more images (receipt, QR code, screenshot), analyze them TOGETHER as parts of a single receipt/document. 
  - If the images are NOT a receipt, QR code with payment info, or financial screenshot, set intent to "unknown" and message to "Чек не распознан".
  - Extract: Amount, date, vendor/description, and possible category.
  - IMPORTANT: Round the total "amount" UP to the nearest whole integer (ruble) using ceiling (e.g., 123.01 becomes 124, 500.00 stays 500). We do not use cents/kopeks.
  - If it is a receipt, the "description" field in "data" MUST contain a Markdown table with columns: "Товар", "Кол-во", "Цена".
  - IMPORTANT: Ensure there is a blank line before any Markdown table in both "message" and "description" fields.
  - If an MCC code is detected on the receipt, append it to the end of the "description" like this: "\\nMCC: [code]".
  - Your "message" MUST also include this Markdown table and MCC code if it's a receipt analysis, followed by your friendly confirmation.
  - If the receipt is for multiple things, use the total or summarize as one transaction unless asked otherwise.
  
  DUPLICATE PREVENTION:
  - Compare the extracted receipt data with the "Recent Transactions" provided in the USER PROMPT.
  - If a transaction with the SAME amount (rounded), SAME vendor/description, and NEARBY date (within the last few days) already exists, set intent to "unknown" and inform the user that this receipt seems to already have been processed.
  
  REFERENCE DATA:
  Accounts: (See USER PROMPT)
  Categories: (See USER PROMPT)
  Recent Transactions: (See USER PROMPT)
  
  IMPORTANT: 
  - If the user mentions an account or category by name, you MUST find its corresponding "id" from the REFERENCE DATA and use that "id" in the data object.
  - EVERY value you mention in your "message" (amount, account name, category name, goal name) MUST be present in the "data" object.
  - Never invent or copy amounts, people, dates, accounts, or other details that are absent from the CURRENT USER MESSAGE. Do not use details from examples or recent transactions to fill a reminder.
  - For a reminder, preserve only the reminder the user actually stated. Add a sum or transaction details only if the current user message explicitly includes them.
  - If you cannot find a matching ID for an account or category mentioned by the user, set intent to "unknown" and ask for clarification.
  - You MUST return the intent and data even if some parameters are missing, as long as you have identified the intent and at least ONE parameter.
  - Only set intent to "unknown" and ask for clarification if more than ONE required parameter is missing.
  - MONEY AMOUNTS IN RUSSIAN SPEECH: when a number is followed by "руб./рублей/₽" and there is no explicit mention of копейки, a dot or comma before a three-digit group is a thousands separator, not a decimal separator. For example, "30.015 руб" and "30,015 руб" mean 30015 rubles. Do not turn them into 30.015 rubles. Only use fractional rubles when the user explicitly says "копейки" or clearly dictates a fractional amount.
  - For transaction intent, required fields in each transaction are: type, amount, accountId, accountName, categoryId, createdAt.
  - If the user describes several separate operations in one message, split them into separate transaction objects and return them together as data.transactions. Do not merge distinct actions joined by "и", "а также", "затем" or similar wording.
  - Each item in data.transactions must be processed independently. Keep an item even when one or more fields are missing so the application can open an editor for that item; do not discard an operation just because another item is incomplete.
  - For a single operation, keep the existing shape and return the transaction fields directly in data. For multiple operations, data must be an object with a transactions array.
  - TRANSACTION DATE:
    - Always return the transaction date in data.createdAt as YYYY-MM-DD or a valid ISO 8601 timestamp.
    - Resolve relative Russian dates from the current LOCAL date supplied in the user prompt: "сегодня", "вчера", "позавчера", "три дня назад", "на прошлой неделе".
    - Resolve weekdays according to the wording: "в прошлую пятницу" is in the past; "в следующую пятницу" is in the future.
    - Resolve explicit dates such as "5 сентября", "05.09", "5 сентября 2025" and "15.10.2026".
    - Future transaction dates are allowed and must be preserved: "завтра", "послезавтра", "в следующую среду", or an explicit future date.
    - If the user does not mention a date, use the supplied current local date.
    - Never silently replace a mentioned date with today.
  - **PHRASING**: Never claim an action was saved unless the application actually saved it. Transactions are saved only after a successful API request. Calendar plans and notes are only prepared in a form; ask the user to review and save them.
    - For a successfully saved transaction, use phrases like: "Записал твой расход..." or "Добавил операцию в журнал..."
    - Be empathetic, but keep every amount and other factual detail grounded in the current request and REFERENCE DATA.
  - For goal intent: "Я уже подготовил форму для твоей новой цели '...', давай заполним детали вместе."
  - For plan intent, do not claim that a monthly budget plan was updated. AI cannot currently save monthly budget-plan changes; return intent "unknown" and explain that the user must edit it in the Plan section.
  - For calendar_plan intent, say that you prepared the calendar form and ask the user to review and save it. Never claim the payment has already been scheduled.
  - For calendar_note intent, say that you prepared a calendar-note form and ask the user to review and save it.
  - For compound intent, state which actions were recognized; distinguish a saved transaction from a calendar form that still needs the user's confirmation.
  
  Intents:
  - transaction: adding income, expense, or transfer.
  - goal: creating a new financial goal.
  - plan: creating or updating a monthly budget plan. Do not use for a dated reminder; AI cannot save monthly budget-plan changes, so use intent "unknown" for those requests.
  - calendar_plan: creating a one-time or recurring payment/income item in the payment calendar. Do not use this intent for a monthly budget plan.
  - calendar_note: creating a standalone text reminder on a calendar date. Requests containing "напоминание", "напомни", "напоминалка" or "заметка" with a date/day use this intent even if the user says "в плане" or "в план". Do not use this for the note field attached to a planned payment.
  - compound: two or more separate requested actions. Return every action in order in data.actions; do not merge a calendar reminder into a transaction description.
  - advice: asking for financial analysis or tips.
  
  Data object requirements per intent:
  - transaction:
      - for one operation: the fields below directly in data
      - for multiple operations: data.transactions is an array of objects with these fields
      - type: "income", "expense", or "transfer" (required)
      - amount: number (required when stated)
      - accountId/accountName: string (required when stated)
      - targetAccountId/targetAccountName: string (required for transfers when stated)
      - categoryId/categoryName: string (required when stated for income/expense)
      - description: string (optional)
      - createdAt: string (required; YYYY-MM-DD or ISO 8601, may be in the past or future)
  - goal:
      - name: string (required)
      - targetAmount: number (required)
  - calendar_plan:
      - title: string (required when stated; use a concise description)
      - amount: positive number (when stated)
      - date: string in YYYY-MM-DD format. Resolve relative and explicit dates in the user's local time zone; use the supplied current local date if the user did not specify one.
      - transactionType: "expense" or "income" (default to "expense" only when the wording clearly describes a payment)
      - recurrence: "none" for a one-time plan, otherwise one of "weekly", "biweekly", "weekdays", "monthly", "quarterly", "yearly" when stated
      - weekdays: array of integers 1-7 where 1 is Monday and 7 is Sunday, when specified
      - accountId/accountName and categoryId/categoryName: use exact matches from REFERENCE DATA only when identifiable; do not invent IDs
      - time: HH:mm when stated; note: optional text attached to this planned payment
  - calendar_note:
      - date: string in YYYY-MM-DD format, resolved in the user's local time zone
      - text: string containing the reminder; preserve the user's wording and include the related transaction details when the reminder refers to one
      - if the user says a day number without a month, choose its nearest future occurrence; "2-го числа" on 2026-09-24 means 2026-10-02
      - never add a sum, person, or transaction detail the user did not state
  - compound:
      - actions: ordered array of { action, data } objects. action must be "transaction", "calendar_plan", or "calendar_note"; data follows that action's schema above
      - keep each money movement and each calendar reminder as separate actions
      - for a loan transfer, put the short loan description in transaction.description and create a separate calendar_note for the repayment date

  COMPOUND RULE:
    When the current request asks for both a money movement and a reminder, return separate ordered actions. Include transaction details in the reminder only when the user stated those details in the current request. Never copy details from another example or recent transaction.
  
  Return a JSON object with:
  - intent: string (one of: transaction, goal, plan, calendar_plan, calendar_note, compound, advice, unknown)
  - data: object containing the extracted fields.
  - message: string (a concise, friendly, and supportive response in Russian that follows the phrasing rules above for the selected intent)
  `;

  const userPrompt = `User message: "${text}"
Current instant (UTC): ${now.toISOString()}
Current LOCAL date: ${localDate}
Current LOCAL weekday: ${localWeekday}
User time zone: ${timeZone}

REFERENCE DATA:
- Accounts: ${JSON.stringify(mainAccounts.map(a => ({ id: a.id, name: a.name, aliases: a.aliases ? a.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : [] })))}
- Categories: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
- Recent Transactions: ${JSON.stringify((recentTransactions || []).slice(0, 15).map(t => ({ amount: Math.ceil(t.amount), description: t.description, date: t.createdAt })))}
  (Check these to avoid duplicates!)`;

  try {
    const responseText = await callAI(systemInstruction, userPrompt, "json_object", imageData);
    const result = JSON.parse(responseText || "{}") as AIResponse;

    const compoundActions = getAICompoundActions(result.data);
    const isCompound = result.intent === 'compound' || compoundActions.length > 0;
    const transactionDrafts = isCompound
      ? compoundActions
        .filter(action => action.action === 'transaction' || action.action === 'calendar_plan')
        .flatMap(action => {
          const payload = action.data as any;
          if (Array.isArray(payload?.transactions)) return payload.transactions;
          return Array.isArray(payload) ? payload : [payload];
        })
      : Array.isArray(result.data?.transactions)
        ? result.data.transactions
        : Array.isArray(result.data)
          ? result.data
          : [result.data];

    if (
      result.data &&
      (['transaction', 'income', 'expense', 'transfer', 'calendar_plan'].includes(result.intent) ||
        isCompound ||
        transactionDrafts.some(draft => ['income', 'expense', 'transfer'].includes(draft?.type)))
    ) {
      transactionDrafts.forEach(draft => {
        if (draft && typeof draft === 'object') {
          draft.amount = normalizeRussianRublesAmount(text, draft.amount);
        }
      });
    }

    // Ensure message is a string to avoid React rendering errors
    if (result.message && typeof result.message !== 'string') {
      result.message = JSON.stringify(result.message);
    }

    await logAIInteraction(userId, { systemInstruction, userPrompt, hasImages: !!imageData?.length }, result, 'deepseek');

    return result;
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    
    // Check for specific region error
    const errorData = error.response?.data?.error || error.error || {};
    const errorMessage = errorData.message || error.message || "";
    const errorCode = errorData.code || "";

    if (errorCode === 'unsupported_country_region_territory' || errorMessage.includes('supported')) {
      return {
        intent: 'unknown',
        data: { error_code: 'REGION_NOT_SUPPORTED' },
        message: "К сожалению, ваш регион временно не поддерживается AI-сервисом. Попробуйте использовать VPN."
      };
    }

    return {
      intent: 'unknown',
      data: {},
      message: "Извините, произошла ошибка при обращении к AI сервису."
    };
  }
};

export const getFinancialAdvice = async (
  userId: string,
  transactions: Transaction[], 
  goals: Goal[],
  accounts: Account[],
  plans: Plan[]
) => {
  const systemInstruction = "Ты — мудрый финансовый наставник и добрый товарищ. Твои советы должны быть практичными, поддерживающими и вдохновляющими. Используй Markdown для форматирования. Обращайся к пользователю по-дружески.";
  
  const userPrompt = `Уважаемый, посмотри на мои цифры и дай 3 коротких, но важных совета, как мне стать еще лучше в управлении деньгами. Учти только, что цели я могу фиксировать в тысячах, а не в исходых единицах, так удобней. Вот мои данные:
  Транзакции: ${JSON.stringify(transactions.slice(0, 30))}
  Цели: ${JSON.stringify(goals)}
  Счета: ${JSON.stringify(accounts)}
  Планы: ${JSON.stringify(plans)}
  
  Подскажи мне, если:
  - Баланс тает
  - Мы забыли про накопления
  - Планы расходятся с целями`;

  try {
    const advice = await callAI(systemInstruction, userPrompt);
    await logAIInteraction(userId, { systemInstruction, userPrompt }, { text: advice }, 'deepseek');
    return advice;
  } catch (error) {
    console.error("OpenAI Advice Error:", error);
    return "Извините, не удалось получить финансовый совет в данный момент.";
  }
};
