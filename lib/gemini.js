// lib/gemini.js
// 2025-12-01 智能分流修复版：修正第三方 URL 拼接问题 + 官方 2.0 联网
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 环境变量 ---
const OFFICIAL_KEY = process.env.GEMINI_API_KEY; // 官方 Key (用于联网)
const PROXY_KEY = process.env.PROXY_API_KEY;     // 第三方 Key
const PROXY_URL = process.env.PROXY_BASE_URL;    // 第三方地址 (例如 https://api.xyz.com)

// --- 配置 ---
// 第三方用的模型 (通常 1.5-flash 最便宜，你可以改成任何第三方支持的模型)
const PROXY_MODEL = "gemini-1.5-flash"; 

// 触发官方联网的关键词
const SEARCH_KEYWORDS = [
  "今天", "现在", "最新", "新闻", "天气", "股价", "汇率", "搜", "search", 
  "news", "weather", "stock", "什么时候", "几点", "多少钱", "查一下"
];

// --- 初始化官方 SDK (仅用于联网) ---
let officialModel;
try {
  if (OFFICIAL_KEY) {
    const genAI = new GoogleGenerativeAI(OFFICIAL_KEY);
    officialModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // 官方必须用这个新模型
      // 开启联网 (Gemini 2.0 新语法)
      tools: [{ googleSearch: {} }], 
    });
  }
} catch (e) {
  console.error("官方 SDK 初始化失败:", e);
}

// --- 主入口函数 ---
export async function geminiChat(historyMessages, userMessage) {
  // 1. 判断意图：是否包含搜索关键词？
  const needsSearch = SEARCH_KEYWORDS.some(kw => userMessage.includes(kw));

  // 2. 分流逻辑
  if (needsSearch && officialModel) {
    console.log("【路由】检测到搜索意图 -> 切换至 [官方联网通道]");
    try {
      return await callOfficialGemini(historyMessages, userMessage);
    } catch (e) {
      console.error("官方通道失败，尝试降级到第三方...", e);
    }
  } 
  
  if (PROXY_KEY && PROXY_URL) {
    console.log(`【路由】日常闲聊 -> 切换至 [第三方 ${PROXY_MODEL} 通道]`);
    return await callProxyGemini(historyMessages, userMessage);
  }

  // 3. 兜底：如果没有第三方配置，全走官方
  console.log("【路由】无第三方配置 -> 走 [官方通道]");
  return await callOfficialGemini(historyMessages, userMessage);
}

// --- 通道 A: 官方 SDK (带联网) ---
async function callOfficialGemini(historyMessages, userMessage) {
  try {
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
    // 打印详细错误方便调试
    console.error("官方通道报错:", error.toString());
    throw error; // 抛出错误以便降级
  }
}

// --- 通道 B: 第三方代理 (纯文本，省钱) ---
async function callProxyGemini(historyMessages, userMessage) {
  try {
    // 构造请求体
    const contents = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    // 剔除首条非 User 消息
    if (contents.length > 0 && contents[0].role === 'model') contents.shift();

    // -----------------------------------------------------------
    // 🔧 修复核心：清洗 URL，防止 /v1/v1beta 重复拼接
    // -----------------------------------------------------------
    let baseUrl = PROXY_URL;
    // 移除末尾斜杠
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    // 如果用户填了 .../v1，把它去掉，我们要用 /v1beta
    if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3);

    // 拼接正确的 Gemini 原生 REST 路径
    const url = `${baseUrl}/v1beta/models/${PROXY_MODEL}:generateContent?key=${PROXY_KEY}`;
    // -----------------------------------------------------------

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // 安全解析返回结果
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("第三方返回数据格式异常: " + JSON.stringify(data));
    }

  } catch (error) {
    console.error("第三方通道报错:", error);
    // 如果第三方挂了，降级回官方
    if (officialModel) {
        console.log("【自动降级】第三方失败，转为官方通道...");
        return callOfficialGemini(historyMessages, userMessage);
    }
    return `所有通道均不可用: ${error.message}`;
  }
}