// lib/gemini.js
// 2025-11-30 核弹测试版：直接硬编码 Key，排除环境变量干扰
import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ 注意：为了测试，直接写死 Key。测试通了以后记得改回去！
const apiKey = "AIzaSyBhKygpUdPq9G4WWE5qZNgi5oUPSWq8vRQ"; 

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 使用 gemini-1.5-flash
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }
} catch (e) {
  console.error("Gemini 初始化失败:", e);
}

export async function geminiChat(historyMessages, userMessage) {
  if (!model) {
    return "系统错误：Key 初始化失败。";
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
    // 把那个该死的 Key 打印出来看看（只打后4位），到底用的哪一把钥匙
    console.error(`Gemini Error (Key尾号 ${apiKey.slice(-4)}):`, error.toString());
    return "AI 连接失败，请检查 Vercel 日志。";
  }
}