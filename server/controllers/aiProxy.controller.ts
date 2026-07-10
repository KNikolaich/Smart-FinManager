import * as aiProxyService from "../services/aiProxy.service";

export async function openai(req: any, res: any) {
  try {
    const content = await aiProxyService.callOpenAi(req.body);
    res.json({ content });
  } catch (error: any) {
    console.error("OpenAI Proxy Error:", error.response?.data || error.message);
    res.status(error.response?.status || error.status || 500).json({
      error: "Failed to call OpenAI API",
      details: error.response?.data || error.message
    });
  }
}

export async function deepseek(req: any, res: any) {
  try {
    const content = await aiProxyService.callDeepseek(req.body);
    res.json({ content });
  } catch (error: any) {
    console.error("DeepSeek Proxy Error:", error.response?.data || error.message);
    res.status(error.response?.status || error.status || 500).json({
      error: "Failed to call DeepSeek API",
      details: error.response?.data || error.message
    });
  }
}
