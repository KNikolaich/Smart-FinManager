import { Account, Category, Transaction, Goal, Plan, Message } from "../types";
import { api } from "../lib/api";
import axios from "axios";

export interface AIResponse {
  intent: 'transaction' | 'goal' | 'plan' | 'advice' | 'unknown';
  data: any;
  message: string;
}

const logAIInteraction = async (userId: string, request: any, response: any) => {
  if (!userId) {
    return;
  }
  try {
    await api.post('/ai-logs', {
      request,
      response,
      provider: 'deepseek'
    });
  } catch (error) {
    console.error('Error logging AI interaction:', error);
  }
};

const callDeepSeek = async (systemInstruction: string, userPrompt: string, responseFormat?: "json_object") => {
  const response = await api.post<{ content: string }>("/ai/deepseek", {
    systemInstruction,
    userPrompt,
    responseFormat
  });
  return response.content;
};

export const processUserMessage = async (
  userId: string,
  text: string, 
  accounts: Account[], 
  categories: Category[]
): Promise<AIResponse> => {
  const mainAccounts = accounts.filter(a => a.showOnDashboard && !a.isArchived);
  
  const systemInstruction = `Ты — мудрый и дружелюбный финансовый ассистент, как понимающий старший товарищ. Твоя цель — помогать пользователю управлять деньгами легко и без стресса. Говори по-дружески, но конкретно.
  
  Твой тон: теплый, поддерживающий, уверенный. Ты не просто бот, ты — наставник, который уже все сделал за пользователя.

  REFERENCE DATA:
  Accounts: ${JSON.stringify(mainAccounts.map(a => ({ id: a.id, name: a.name })))}
  Categories: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
  
  IMPORTANT: 
  - If the user mentions an account or category by name, you MUST find its corresponding "id" from the REFERENCE DATA above and use that "id" in the data object.
  - EVERY value you mention in your "message" (amount, account name, category name, goal name) MUST be present in the "data" object.
  - If you cannot find a matching ID for an account or category mentioned by the user, set intent to "unknown" and ask for clarification.
  - You MUST return the intent and data even if some parameters are missing, as long as you have identified the intent and at least ONE parameter.
  - Only set intent to "unknown" and ask for clarification if more than ONE required parameter is missing.
  - For transaction intent, required fields in "data" are: type, amount, accountId, accountName, categoryId.
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
  
  Return a JSON object with:
  - intent: string (one of: transaction, goal, plan, advice, unknown)
  - data: object containing the extracted fields.
  - message: string (a concise, friendly, and supportive response in Russian confirming the fact that the action was taken)
  `;

  const userPrompt = `User message: "${text}"\nCurrent date: ${new Date().toISOString()}\n\nREFERENCE DATA:\nAccounts: ${JSON.stringify(mainAccounts.map(a => ({ id: a.id, name: a.name })))} \nCategories: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}`;

  try {
    const responseText = await callDeepSeek(systemInstruction, userPrompt, "json_object");
    const result = JSON.parse(responseText || "{}") as AIResponse;

    // Ensure message is a string to avoid React rendering errors
    if (result.message && typeof result.message !== 'string') {
      result.message = JSON.stringify(result.message);
    }

    await logAIInteraction(userId, { systemInstruction, userPrompt }, result);

    return result;
  } catch (error) {
    console.error("DeepSeek Error:", error);
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
  const systemInstruction = "Ты — мудрый финансовый наставник и добрый друг. Твои советы должны быть практичными, поддерживающими и вдохновляющими. Используй Markdown для форматирования. Обращайся к пользователю по-дружески.";
  
  const userPrompt = `Друг, посмотри на мои цифры и дай 3 коротких, но важных совета, как мне стать еще лучше в управлении деньгами. Вот мои данные:
  Транзакции: ${JSON.stringify(transactions.slice(0, 30))}
  Цели: ${JSON.stringify(goals)}
  Счета: ${JSON.stringify(accounts)}
  Планы: ${JSON.stringify(plans)}
  
  Подскажи мне, если:
  - Баланс тает
  - Мы забыли про накопления
  - Планы расходятся с целями`;

  try {
    const advice = await callDeepSeek(systemInstruction, userPrompt);
    await logAIInteraction(userId, { systemInstruction, userPrompt }, { text: advice });
    return advice;
  } catch (error) {
    console.error("DeepSeek Advice Error:", error);
    return "Извините, не удалось получить финансовый совет в данный момент.";
  }
};
