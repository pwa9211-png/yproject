// lib/gemini.js
// 2025-11-30 Gemini 2.0 专用版：修正搜索参数为 googleSearch
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", 
      tools: [
        {
          // 🔴 关键修改：Gemini 2.0 要求用 googleSearch，而不是 googleSearchRetrieval
          // 而且它不需要复杂的配置，这就代表开启联网
          googleSearch: {}, 
        },
      ],
    });
  } else {
    console.error("警告: 未检测到 GEMINI_API_KEY 环境变量");
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

    // 剔除首条非 User 消息
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