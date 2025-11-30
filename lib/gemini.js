// lib/gemini.js
// 2025-11-30 修复版 V2：更改模型名称为 gemini-1.5-flash-002 以解决 404 问题
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 关键修改：将 "gemini-1.5-flash" 改为具体的 "gemini-1.5-flash-002"
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002", 
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: "MODE_DYNAMIC", 
              dynamicThreshold: 0.6, 
            },
          },
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
    return "系统错误：未配置 Google API Key，请检查后台设置。";
  }

  try {
    // 1. 转换格式
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 2. 剔除首条非 User 消息
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
    // 如果出错，把详细错误打印在控制台，方便调试
    return "AI 遇到问题了（可能是模型名称或网络问题），请稍后重试。";
  }
}