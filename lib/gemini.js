// lib/gemini.js
// 2025-11-30 终极修正版：回滚标准模型名 + 修复参数大小写 + 修复历史记录
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 1. 改回最标准的模型名称 'gemini-1.5-flash'
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", 
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              // 2. 保持这个关键修复：必须是大写的 "MODE_DYNAMIC"
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
    // 3. 保持历史记录格式修复
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 剔除首条非 User 消息
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      console.log('【Gemini】检测到历史记录首条为 AI 消息，已自动移除。');
      validHistory.shift(); 
    }

    const chat = model.startChat({
      history: validHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 遇到问题了，请稍后重试。";
  }
}