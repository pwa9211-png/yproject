// lib/gemini.js
// 2025-12-01 旗舰版：第三方(Gemini 2.0/3.0) + 官方(联网)
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 配置区域 ---
// 1. 官方配置 (用于联网)
const OFFICIAL_KEY = process.env.GEMINI_API_KEY;

// 2. 第三方配置 (用于日常闲聊)
const PROXY_KEY = process.env.PROXY_API_KEY;
const PROXY_URL = process.env.PROXY_BASE_URL; 
//在这里指定第三方要用的模型，以后有了 3.0 直接改这里即可，例如 "gemini-3.0-pro"
const PROXY_MODEL = "gemini-2.0-flash"; 

// 3. 关键词路由：出现这些词，强制切换到官方联网版
const SEARCH_KEYWORDS = [
  "今天", "现在", "最新", "新闻", "天气", "股价", "汇率", "搜", "search", 
  "news", "weather", "stock", "什么时候", "几点", "多少钱", "查一下"
];
// ----------------

// 初始化官方客户端 (仅用于联网)
let officialModel;
try {
  if (OFFICIAL_KEY) {
    const genAI = new GoogleGenerativeAI(OFFICIAL_KEY);
    officialModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} }], // 开启联网
    });
  }
} catch (e) {
  console.error("官方 SDK 初始化失败:", e);
}

export async function geminiChat(historyMessages, userMessage) {
  // 1. 判断意图
  const needsSearch = SEARCH_KEYWORDS.some(kw => userMessage.includes(kw));

  // 2. 路由逻辑
  if (needsSearch && officialModel) {
    console.log("【路由】检测到搜索意图 -> 切换至 [官方联网通道]");
    return await callOfficialGemini(historyMessages, userMessage);
  } else if (PROXY_KEY && PROXY_URL) {
    console.log(`【路由】日常闲聊 -> 切换至 [第三方 ${PROXY_MODEL} 通道]`);
    return await callProxyGemini(historyMessages, userMessage);
  } else {
    console.log("【路由】未配置第三方 -> 走 [官方通道]");
    return await callOfficialGemini(historyMessages, userMessage);
  }
}

// 通道 A: 官方 SDK (带联网)
async function callOfficialGemini(historyMessages, userMessage) {
  try {
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    if (validHistory.length > 0 && validHistory[0].role === 'model') validHistory.shift();

    const chat = officialModel.startChat({ history: validHistory });
    const result = await chat.sendMessage(userMessage);
    return await result.response.text();
  } catch (error) {
    console.error("官方通道报错:", error);
    return `官方联网服务暂时不可用: ${error.message}`;
  }
}

// 通道 B: 第三方代理 (自定义模型)
async function callProxyGemini(historyMessages, userMessage) {
  try {
    const contents = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    if (contents.length > 0 && contents[0].role === 'model') contents.shift();

    // 动态拼接 URL，支持自定义模型
    const cleanBaseUrl = PROXY_URL.replace(/\/$/, ''); 
    // 注意：Gemini API 标准路径通常为 v1beta/models/{modelName}:generateContent
    const url = `${cleanBaseUrl}/v1beta/models/${PROXY_MODEL}:generateContent?key=${PROXY_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
      throw new Error(`Proxy HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("第三方通道报错:", error);
    // 自动降级策略：如果第三方挂了，尝试走官方
    if (officialModel) {
        console.log("【降级】尝试切换回官方通道...");
        return callOfficialGemini(historyMessages, userMessage);
    }
    return `服务连接失败: ${error.message}`;
  }
}