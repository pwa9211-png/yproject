// lib/gemini.js
// 2025-11-30 紧急修复版：暂时移除搜索工具，优先保证基础对话畅通
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 回归最基础的设置，移除 tools (联网搜索)
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", 
    });
  } else {
    console.error("警告: 未检测到 GEMINI_API_KEY 环境变量");
  }
} catch (e) {
  console.error("Gemini 初始化失败:", e);
}

export async function geminiChat(historyMessages, userMessage) {
  if (!model) {
    return "系统错误：未配置 Google API Key，请检查后台设置。";
  }

  try {
    // 1. 转换格式
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 2. 依然保留这个关键修复：剔除首条非 User 消息
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      console.log('【Gemini】检测到历史记录首条为 AI 消息，已自动移除。');
      validHistory.shift(); 
    }

    // 启动对话
    const chat = model.startChat({
      history: validHistory,
    });

    // 发送消息
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 暂时无法连接，请稍后重试。";
  }
}