// lib/gemini.js
// 这是专门负责和 Google Gemini 聊天的文件
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // 使用免费且快速的 Flash 模型
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: "dynamic", // 智能模式：AI 自己决定什么时候上网搜
              dynamicThreshold: 0.6, // 阈值：调低一点让它更愿意上网
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
    // 启动对话，传入历史记录
    const chat = model.startChat({
      history: historyMessages.map(msg => ({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
    });

    // 发送新消息
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    
    // 返回 AI 的回答
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 思考超时或连接中断，请稍后重试。";
  }
}