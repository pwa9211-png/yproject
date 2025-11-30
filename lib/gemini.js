// lib/gemini.js
// 2025-11-30 兼容性优先版：使用 'gemini-pro' (1.0) + 增强错误日志
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 使用 gemini-pro (1.0版本)，这是目前API兼容性最强的模型，先保证能通！
    model = genAI.getGenerativeModel({ model: "gemini-pro" });
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
    // 格式化历史记录
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 剔除首条非 User 消息 (这是 Gemini 的死规矩)
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
    // 强制把错误转成字符串打印，防止出现 "{}" 这种情况
    console.error("Gemini Final Error:", error.toString());
    
    // 如果有更详细的 response 错误信息，尝试打印
    if (error.response) {
       console.error("Error Details:", JSON.stringify(error.response, null, 2));
    }
    
    return "AI 暂时无法连接，请稍后重试。";
  }
}