// lib/gemini.js
// 2025-11-30 修复版：自动剔除历史记录首条为 AI 消息的情况
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", 
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

    // 2. 【关键修复】Gemini 要求历史记录第一条必须是 user。
    // 如果第一条是 model，就把它移除掉。
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      console.log('【Gemini】检测到历史记录首条为 AI 消息，已自动移除以符合 API 规范。');
      validHistory.shift(); // 删除数组第一个元素
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
    return "AI 思考超时或连接中断，请稍后重试。";
  }
}