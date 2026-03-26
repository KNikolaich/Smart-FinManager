import { Account, Category, Transaction, Goal, Budget, Plan, Message } from "../types";
import { db } from "../firebase";
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { GoogleGenAI, Type } from "@google/genai";

export interface AIResponse {
  intent: 'transaction' | 'goal' | 'plan' | 'advice' | 'unknown';
  data: any;
  message: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const logAIInteraction = async (userId: string, request: any, response: any) => {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'ai_logs'), {
      userId,
      request,
      response,
      provider: 'gemini',
      createdAt: new Date().toISOString()
    });

    const q = query(
      collection(db, 'ai_logs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.size > 100) {
      const toDelete = snapshot.docs.slice(100);
      await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'ai_logs', d.id))));
    }
  } catch (error) {
    console.error('Error logging AI interaction:', error);
  }
};

export const processUserMessage = async (
  userId: string,
  text: string, 
  history: Message[],
  accounts: Account[], 
  categories: Category[], 
  transactions: Transaction[], 
  goals: Goal[], 
  budgets: Budget[],
  plans: Plan[]
): Promise<AIResponse> => {
  const mainAccounts = accounts.filter(a => a.showOnDashboard);
  
  const systemInstruction = `Ты — вежливый, краткий и обходительный финансовый ассистент. Твоя задача — помогать пользователю управлять финансами. Отвечай на русском языке. Если видишь, что необходимо создать цель или операцию, возвращай строго типизированный объект со всеми найдеными свойствами операции или цели. Все извлеченные данные (сумма, счета, категории, названия) ОБЯЗАТЕЛЬНО должны быть помещены в соответствующие поля объекта 'data'. Не пропускай ни одного поля, если данные для него есть. Будь настойчив, если необходима консультация по бюджету и видишь проблемы, не стесняйся о них сообщить. Ответ пользователю должен быть лаконичен и точен. ВАЖНО: Твой ответ должен быть ТОЛЬКО чистым JSON объектом без каких-либо пояснений или рассуждений внутри полей.

  REFERENCE DATA (Use these IDs for structured output):
  Main Accounts (isMain/showOnDashboard): ${JSON.stringify(mainAccounts.map(a => ({ id: a.id, name: a.name })))}
  All Categories: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, type: c.type })))}
  
  Current goals: ${JSON.stringify(goals.map(g => ({ id: g.id, name: g.name, target: g.targetAmount, current: g.currentAmount })))}
  Current plans: ${JSON.stringify(plans.map(p => ({ id: p.id, name: p.name, amount: p.plannedAmount })))}
  
  Determine the user's intent and extract relevant data.
  IMPORTANT: 
  - If the user mentions an account or category by name, you MUST find its corresponding "id" from the REFERENCE DATA above and use that "id" in the data object.
  - EVERY value you mention in your "message" (amount, account name, category name, goal name) MUST be present in the "data" object.
  - If you cannot find a matching ID for an account or category mentioned by the user, set intent to "unknown" and ask for clarification.
  - Only use "transaction", "goal", or "plan" intents if you have ALL required data. If any required field is missing, you MUST set intent to "unknown" and ask a clarifying question in the "message".
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
  - goal:
      - name: string (required)
      - targetAmount: number (required)
      - deadline: ISO string (optional)
  - plan:
      - name: string (required)
      - plannedAmount: number (required)
      - accountId: string (required)
      - accountName: string (required)
      - priority: "low", "medium", "high"
      - dateOfFinish: ISO string
  
  Return a JSON object with:
  - intent: string (one of: transaction, goal, plan, advice, unknown)
  - data: object containing the extracted fields.
  - message: string (a concise, polite, and helpful response in Russian confirming what you understood)
  
  CRITICAL: The JSON output must be clean. DO NOT include any internal reasoning, chain of thought, or explanations inside the JSON fields. All extracted values MUST be in the 'data' object fields, NOT in the 'message' or 'intent' fields.`;

  const contents = [
    ...history.map(m => ({ 
      role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model', 
      parts: [{ text: m.content }]
    })),
    { role: "user", parts: [{ text: `User message: "${text}"\nCurrent date: ${new Date().toISOString()}` }] }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, description: "one of: transaction, goal, plan, advice, unknown" },
          data: { type: Type.OBJECT, description: "extracted fields" },
          message: { type: Type.STRING, description: "concise response in Russian" }
        },
        required: ["intent", "data", "message"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}") as AIResponse;

  // Ensure message is a string to avoid React rendering errors
  if (result.message && typeof result.message !== 'string') {
    result.message = JSON.stringify(result.message);
  }

  await logAIInteraction(userId, { contents }, result);

  return result;
};

export const getFinancialAdvice = async (
  userId: string,
  transactions: Transaction[], 
  budgets: Budget[], 
  goals: Goal[],
  accounts: Account[],
  plans: Plan[]
) => {
  const systemInstruction = "Ты — профессиональный финансовый консультант. Твои советы должны быть конкретными, вежливыми и краткими. Используй Markdown для форматирования.";
  
  const userPrompt = `Проанализируй финансы пользователя и дай 3 кратких совета на русском языке.
  Транзакции за последний месяц: ${JSON.stringify(transactions.slice(0, 30))}
  Бюджеты: ${JSON.stringify(budgets)}
  Цели: ${JSON.stringify(goals)}
  Счета: ${JSON.stringify(accounts)}
  Планы: ${JSON.stringify(plans)}
  
  Обрати внимание на:
  - Превышение бюджета
  - Снижение баланса
  - Отсутствие накоплений
  - Несоответствие планов и целей`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction
    }
  });

  const advice = response.text || "";
  
  await logAIInteraction(userId, { systemInstruction, userPrompt }, { text: advice });

  return advice;
};
