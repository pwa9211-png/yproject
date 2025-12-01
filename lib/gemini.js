// lib/gemini.js
// 2025-12-01 智能混合双打版：第三方(日常) + 官方(联网)
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 配置区域 ---
// 1. 官方配置 (用于联网)
const OFFICIAL_KEY = process.env.GEMINI_API_KEY;
// 2. 第三方配置 (用于日常闲聊)
const PROXY_KEY = process.env.PROXY_API_KEY;
const PROXY_URL = process.env.PROXY_BASE_URL; // 例如: https://api.xyz.com

// 3. 关键词路由：出现这些词，强制切换到官方联网版
const SEARCH_KEYWORDS = [
  "今天", "现在", "最新", "新闻", "天气", "股价", "汇率", "搜", "search", 
  "news", "weather", "stock", "什么时候", "几点", "多少钱"
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

/**
 * 核心函数：智能分流
 */
export async function geminiChat(historyMessages, userMessage) {
  // 1. 判断意图：是否包含搜索关键词？
  const needsSearch = SEARCH_KEYWORDS.some(kw => userMessage.includes(kw));

  // 2. 路由逻辑
  if (needsSearch && officialModel) {
    console.log("【路由】检测到搜索意图 -> 切换至 [官方联网通道]");
    return await callOfficialGemini(historyMessages, userMessage);
  } else if (PROXY_KEY && PROXY_URL) {
    console.log("【路由】日常闲聊 -> 切换至 [第三方廉价通道]");
    return await callProxyGemini(historyMessages, userMessage);
  } else {
    // 兜底：如果没有配置第三方，就全部走官方
    console.log("【路由】未配置第三方 -> 走 [官方通道]");
    return await callOfficialGemini(historyMessages, userMessage);
  }
}

/**
 * 通道 A: 官方 SDK (带联网)
 */
async function callOfficialGemini(historyMessages, userMessage) {
  try {
    // 格式化历史
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    // 剔除首条非 User 消息
    if (validHistory.length > 0 && validHistory[0].role === 'model') validHistory.shift();

    const chat = officialModel.startChat({ history: validHistory });
    const result = await chat.sendMessage(userMessage);
    return await result.response.text();
  } catch (error) {
    console.error("官方通道报错:", error);
    return `官方联网服务暂时不可用: ${error.message}`;
  }
}

/**
 * 通道 B: 第三方代理 (纯文本，省钱)
 * 使用原生 fetch 实现，兼容性最强
 */
async function callProxyGemini(historyMessages, userMessage) {
  try {
    // 构造请求体 (适配标准 Gemini REST API 格式)
    const contents = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    // 把当前消息加入
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    // 剔除首条非 User 消息 (防止第三方也报错)
    if (contents.length > 0 && contents[0].role === 'model') contents.shift();

    // 拼接完整的第三方 URL
    // 假设 PROXY_BASE_URL 是 https://api.example.com
    // 目标是 https://api.example.com/v1beta/models/gemini-1.5-flash:generateContent?key=...
    // 注意：这里使用 1.5-flash 因为它是最常见的廉价模型，你可以根据第三方支持情况修改
    const cleanBaseUrl = PROXY_URL.replace(/\/$/, ''); // 去掉末尾斜杠
    const url = `${cleanBaseUrl}/v1beta/models/gemini-1.5-flash:generateContent?key=${PROXY_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
      throw new Error(`Proxy HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    // 解析 Gemini 标准响应格式
    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error("第三方通道报错:", error);
    // 如果第三方挂了，可以尝试自动降级回官方 (可选)
    // return callOfficialGemini(historyMessages, userMessage); 
    return `第三方服务连接失败: ${error.message}`;
  }
}