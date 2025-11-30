// lib/gemini.js
// 修复版：修正了 googleSearchRetrieval 的参数格式
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
              // 关键修改：必须是大写的 "MODE_DYNAMIC"
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
    const chat = model.startChat({
      history: historyMessages.map(msg => ({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    // 简单的错误处理，避免前端崩掉
    return "AI 思考超时或连接中断，请稍后重试。";
  }
}