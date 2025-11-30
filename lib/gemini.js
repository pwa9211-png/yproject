// lib/gemini.js
// 2025-11-30 验身版：打印 Key 前缀，确认是否加载了新 Key
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

// --- 调试代码 ---
if (apiKey) {
  console.log(`【DEBUG】当前使用的 API Key 前缀: ${apiKey.substring(0, 5)}...`);
  // 你刚才截图的新 Key 是 AIzaS... 
  // 如果日志里打印的不是 AIzaS，或者打印的是你旧 Key 的前缀，那就破案了！
} else {
  console.error("【DEBUG】严重警告：没有读取到 API Key！");
}
// ----------------

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }
} catch (e) {
  console.error("Gemini 初始化失败:", e);
}

export async function geminiChat(historyMessages, userMessage) {
  if (!model) {
    return "系统错误：未配置 Google API Key。";
  }

  try {
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      validHistory.shift(); 
    }

    const chat = model.startChat({
      history: validHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Gemini Error:", error.toString());
    return "AI 连接失败，请检查 Vercel 日志。";
  }
}