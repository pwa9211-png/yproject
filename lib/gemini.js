// lib/gemini.js
// 2025-11-30 最终完全体：Gemini 2.0 Flash + 联网搜索 (Google Search Grounding)
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      // 1. 坚持使用你账号支持的 2.0 模型
      model: "gemini-2.0-flash", 
      // 2. 重新开启联网搜索工具
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              // 3. 关键参数：必须是大写的 "MODE_DYNAMIC"
              mode: "MODE_DYNAMIC", 
              dynamicThreshold: 0.6, // 阈值：0.6 代表它会比较积极地上网搜
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
    return "系统错误：未配置 Google API Key。";
  }

  try {
    // 转换历史记录格式
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 剔除首条非 User 消息 (Gemini 的硬性规定)
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
    // 如果联网搜索失败，通常会在这里报错，方便我们排查
    return "AI 连接失败，请检查 Vercel 日志。";
  }
}