// lib/gemini.js
// 2025-11-30 绝地求生版：切换至最稳定的 'gemini-pro' 模型，排除一切版本干扰
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // ⚠️ 关键改动：使用 gemini-pro，这是目前兼容性最好的模型别名
    model = genAI.getGenerativeModel({ model: "gemini-pro" });
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
    // 格式化历史记录 (Gemini Pro 对 role 要求极严)
    // 1. 映射角色: assistant -> model, user -> user
    // 2. 确保第一条是 user
    let validHistory = [];
    
    // 简单的转换逻辑
    let tempHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 过滤逻辑：剔除首条非 User 消息
    if (tempHistory.length > 0 && tempHistory[0].role === 'model') {
      tempHistory.shift();
    }
    validHistory = tempHistory;

    const chat = model.startChat({
      history: validHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text();

  } catch (error) {
    // 打印最原始的错误对象，不仅仅是 error.message
    console.error("Gemini Critical Error:", JSON.stringify(error, null, 2));
    return `AI 暂时罢工 (模式: Pro)。错误代码: ${error.message || '未知'}`;
  }
}