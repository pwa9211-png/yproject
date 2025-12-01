// lib/gemini.js
// 2025-12-01 回归纯净版：Gemini 2.0 Flash + 联网搜索
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      // 必须用这个你账号支持的新模型
      model: "gemini-2.0-flash", 
      // 开启联网 (Gemini 2.0 新语法)
      tools: [{ googleSearch: {} }], 
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
    // 1. 整理历史记录格式
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 2. 剔除首条非 User 消息 (防报错)
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
    // 如果 Key 还是旧的被封那个，这里会报 403
    return "AI 连接失败，请检查 Vercel 日志。";
  }
}