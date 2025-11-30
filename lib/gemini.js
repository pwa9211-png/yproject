// lib/gemini.js
// 2025-11-30 破釜沉舟版：使用 gemini-pro + 自动列出可用模型
import { GoogleGenerativeAI } from "@google/generative-ai";

// 保持硬编码，排除变量干扰
const apiKey = "AIzaSyBhKygpUdPq9G4WWE5qZNgi5oUPSWq8vRQ"; 

export async function geminiChat(historyMessages, userMessage) {
  // 1. 定义我们要尝试的模型：先试 gemini-pro (最稳)，不行就报错
  const MODEL_NAME = "gemini-pro";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // 格式化历史记录
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      validHistory.shift();
    }

    console.log(`【Gemini】正在尝试使用模型: ${MODEL_NAME}`);
    
    const chat = model.startChat({
      history: validHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error(`❌ 模型 ${MODEL_NAME} 调用失败:`, error.toString());

    // -------------------------------------------------------
    // 🕵️‍♀️ 侦探模式：如果上面失败了，我们直接问 Google 到底什么能用
    // -------------------------------------------------------
    try {
      console.log("【DEBUG】正在尝试列出当前账号可用的所有模型...");
      const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const listData = await listResp.json();
      
      if (listData.models) {
        const availableNames = listData.models.map(m => m.name);
        console.error("【DEBUG】Google 返回的可用模型清单:", JSON.stringify(availableNames, null, 2));
        return `连接失败。日志中已列出可用模型，请把 Logs 发给开发者。`;
      } else {
        console.error("【DEBUG】无法获取模型清单:", JSON.stringify(listData));
      }
    } catch (listError) {
      console.error("【DEBUG】获取模型清单也失败了:", listError);
    }
    // -------------------------------------------------------

    return "AI 暂时无法连接，请查看后台 Logs 获取可用模型列表。";
  }
}