// lib/gemini.js
// 2025-11-30 最终成功版：新账号 + gemini-1.5-flash
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 新账号完美支持这个模型，速度快，且支持后续扩展
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
    // 1. 简单转换格式
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 2. 剔除首条非 User 消息 (防止报错)
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