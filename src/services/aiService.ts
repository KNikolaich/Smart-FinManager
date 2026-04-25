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
  history: Message[],
  accounts: Account[], 
  categories: Category[], 
  transactions: Transaction[], 
  goals: Goal[], 
  plans: Plan[]
): Promise<AIResponse> => {
  const mainAccounts = accounts.filter(a => a.showOnDashboard && !a.isArchived);
  
  const systemInstruction = `Ты — финансовый ассистент. Твоя цель — извлекать данные из сообщений пользователя для создания операций, целей или анализа бюджета.

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
  - For goal intent, required fields in "data" are: name, targetAmount.
  - For plan intent, required fields in "data" are: name, plannedAmount, accountId, accountName.
  - For goal intent, the "message" should be a PROPOSAL to open the goal creation form (e.g., "Я могу открыть форму создания цели для 'Велосипед' на 60000 ₽. Подтвердите?"), NOT a confirmation that it's already done.
  - For transaction or plan intents, the "message" should be a PROPOSAL (e.g., "Я готов записать расход... Подтвердите?"), NOT a confirmation that it's already done. DO NOT use words like "зафиксировано" or "успешно добавлено" in the initial message.
  
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
  - message: string (a concise, polite, and helpful response in Russian confirming what you understood)
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
  const systemInstruction = "Ты — профессиональный финансовый консультант. Твои советы должны быть конкретными, вежливыми и краткими. Используй Markdown для форматирования.";
  
  const userPrompt = `Проанализируй финансы пользователя и дай 3 кратких совета на русском языке.
  Транзакции за последний месяц: ${JSON.stringify(transactions.slice(0, 30))}
  Цели: ${JSON.stringify(goals)}
  Счета: ${JSON.stringify(accounts)}
  Планы: ${JSON.stringify(plans)}
  
  Обрати внимание на:
  - Снижение баланса
  - Отсутствие накоплений
  - Несоответствие планов и целей`;

  try {
    const advice = await callDeepSeek(systemInstruction, userPrompt);
    await logAIInteraction(userId, { systemInstruction, userPrompt }, { text: advice });
    return advice;
  } catch (error) {
    console.error("DeepSeek Advice Error:", error);
    return "Извините, не удалось получить финансовый совет в данный момент.";
  }
};
