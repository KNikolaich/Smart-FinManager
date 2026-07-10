import axios from "axios";

export async function callOpenAi(body: any) {
  const { systemInstruction, userPrompt, messages, responseFormat, model = "gpt-4o" } = body;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing in server environment");
    const err: any = new Error("OpenAI API key is not configured on the server.");
    err.status = 500;
    throw err;
  }

  const openaiMessages: any[] = [];

  if (systemInstruction) {
    openaiMessages.push({ role: "system", content: systemInstruction });
  }

  if (messages && Array.isArray(messages)) {
    openaiMessages.push(...messages);
  } else if (userPrompt) {
    openaiMessages.push({ role: "user", content: userPrompt });
  }

  const payload: any = {
    model: model,
    messages: openaiMessages,
    temperature: 0.7
  };

  if (responseFormat === "json_object") {
    payload.response_format = { type: "json_object" };
  }

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      }
    }
  );

  return response.data.choices[0].message.content;
}

export async function callDeepseek(body: any) {
  const { systemInstruction, userPrompt, messages, responseFormat, model = "deepseek-chat" } = body;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY is missing in server environment");
    const err: any = new Error("DeepSeek API key is not configured on the server.");
    err.status = 500;
    throw err;
  }

  const deepseekMessages: any[] = [];

  if (systemInstruction) {
    deepseekMessages.push({ role: "system", content: systemInstruction });
  }

  if (messages && Array.isArray(messages)) {
    deepseekMessages.push(...messages);
  } else if (userPrompt) {
    deepseekMessages.push({ role: "user", content: userPrompt });
  }

  const response = await axios.post(
    "https://api.deepseek.com/chat/completions",
    {
      model,
      messages: deepseekMessages,
      response_format: responseFormat ? { type: responseFormat } : undefined,
      temperature: 0.7
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      }
    }
  );

  return response.data.choices[0].message.content;
}
