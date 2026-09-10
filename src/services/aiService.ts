import { Account, Category, Transaction, Goal, Plan, Message } from "../types";
import { api } from "../lib/api";
import axios from "axios";

export interface AIResponse {
  intent: 'transaction' | 'goal' | 'plan' | 'advice' | 'unknown';
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
  - If you cannot find a matching ID for an account or category mentioned by the user, set intent to "unknown" and ask for clarification.
  - You MUST return the intent and data even if some parameters are missing, as long as you have identified the intent and at least ONE parameter.
  - Only set intent to "unknown" and ask for clarification if more than ONE required parameter is missing.
  - MONEY AMOUNTS IN RUSSIAN SPEECH: when a number is followed by "руб./рублей/₽" and there is no explicit mention of копейки, a dot or comma before a three-digit group is a thousands separator, not a decimal separator. For example, "30.015 руб" and "30,015 руб" mean 30015 rubles. Do not turn them into 30.015 rubles. Only use fractional rubles when the user explicitly says "копейки" or clearly dictates a fractional amount.
  - For transaction intent, required fields in "data" are: type, amount, accountId, accountName, categoryId, createdAt.
  - TRANSACTION DATE:
    - Always return the transaction date in data.createdAt as YYYY-MM-DD or a valid ISO 8601 timestamp.
    - Resolve relative Russian dates from the current LOCAL date supplied in the user prompt: "сегодня", "вчера", "позавчера", "три дня назад", "на прошлой неделе".
    - Resolve weekdays according to the wording: "в прошлую пятницу" is in the past; "в следующую пятницу" is in the future.
    - Resolve explicit dates such as "5 сентября", "05.09", "5 сентября 2025" and "15.10.2026".
    - Future transaction dates are allowed and must be preserved: "завтра", "послезавтра", "в следующую среду", or an explicit future date.
    - If the user does not mention a date, use the supplied current local date.
    - Never silently replace a mentioned date with today.
  - **PHRASING**: Never ask for confirmation if you have all the data. Communicate that the action is DONE. 
    - Use phrases like: "Записал твой расход...", "Добавил операцию в базу...", "Готово, отметил это в журнале...", "Сделано! Твои траты по категории... учтены."
    - Be empathetic: "Вижу, зашел перекусить? Отметил твой обед в расходах по карте...", "Пополнил твой счет..., молодец, так держать!"
  - For goal intent: "Я уже подготовил форму для твоей новой цели '...', давай заполним детали вместе."
  - For plan intent: "Обновил твои планы, теперь мы точно знаем, куда идем."
  
  Intents:
  - transaction: adding income, expense, or transfer.
  - goal: creating a new financial goal.
  - plan: creating or updating a financial plan for a month.
  - advice: asking for financial analysis or tips.
  
  Data object requirements per intent:
  - transaction:
      - type: "income", "expense", or "transfer" (required)
      - amount: number (required)
      - accountId: string (required)
      - accountName: string (required)
      - targetAccountId: string (required for transfers)
      - categoryId: string (required)
      - description: string (optional)
      - createdAt: string (required; YYYY-MM-DD or ISO 8601, may be in the past or future)
  - goal:
      - name: string (required)
      - targetAmount: number (required)
  
  Return a JSON object with:
  - intent: string (one of: transaction, goal, plan, advice, unknown)
  - data: object containing the extracted fields.
  - message: string (a concise, friendly, and supportive response in Russian confirming the fact that the action was taken)
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

    if (result.data && ['transaction', 'income', 'expense', 'transfer'].includes(result.intent) || (
      result.data && ['income', 'expense', 'transfer'].includes(result.data.type)
    )) {
      result.data.amount = normalizeRussianRublesAmount(text, result.data.amount);
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
