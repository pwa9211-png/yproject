// lib/gemini.js
// 2025-12-10 极速版：已更新支持 gemini-2.5-flash
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 环境变量 ---
const OFFICIAL_KEY = process.env.GEMINI_API_KEY; // 官方 Key
const PROXY_KEY = process.env.PROXY_API_KEY;     // 第三方 Key
const PROXY_URL = process.env.PROXY_BASE_URL;    // 第三方地址

// --- 配置 ---
// 【已根据你的截图修正】
const TARGET_MODEL = "gemini-2.5-flash"; 

// 触发官方联网的关键词
const SEARCH_KEYWORDS = [
  "今天", "现在", "最新", "新闻", "天气", "股价", "汇率", "搜", "search", 
  "news", "weather", "stock", "什么时候", "几点", "多少钱", "查一下"
];

// --- 初始化官方 SDK ---
let officialModel;
try {
  if (OFFICIAL_KEY) {
    const genAI = new GoogleGenerativeAI(OFFICIAL_KEY);
    officialModel = genAI.getGenerativeModel({
      model: TARGET_MODEL, 
      // 尝试开启工具。注意：由于你每天只有 20 次额度，搜索可能会消耗更多 Token。
      // 如果 2.5 版本不支持 search 工具导致报错，请删除下面这行 tools 配置。
      tools: [{ googleSearch: {} }], 
    });
  }
} catch (e) {
  console.error("官方 SDK 初始化警告:", e.message);
}

// --- 主入口函数 ---
export async function geminiChat(historyMessages, userMessage) {
  const needsSearch = SEARCH_KEYWORDS.some(kw => userMessage.includes(kw));
  let finalError = null;

  // 1. 官方通道 (仅当有搜索意图且 Key 存在时尝试)
  // 考虑到你的官方额度极低 (20次/天)，我们只把最关键的搜索请求给官方
  if (needsSearch && officialModel) {
    console.log(`【路由】检测到搜索意图 -> 尝试 [官方 ${TARGET_MODEL}]`);
    try {
      return await callOfficialGemini(historyMessages, userMessage);
    } catch (e) {
      console.warn("官方通道限流或失败 (429/报错)，准备切换第三方...", e.message);
      finalError = e;
    }
  } 
  
  // 2. 第三方通道 (主力通道)
  // 既然官方每天只能用 20 次，我们把大部分普通聊天都丢给第三方
  if (PROXY_KEY && PROXY_URL) {
    console.log(`【路由】尝试 [第三方 ${TARGET_MODEL} 通道]`);
    try {
      return await callProxyGemini(historyMessages, userMessage);
    } catch (e) {
      console.error("第三方通道失败:", e.message);
      finalError = e;
    }
  }

  // 3. 兜底 (如果第三方挂了，且不是搜索请求，再试一次官方)
  if (OFFICIAL_KEY && !needsSearch) {
     console.log("【路由】兜底 -> 走 [官方通道(无搜索)]");
     try {
        return await callOfficialGemini(historyMessages, userMessage, false); 
     } catch (e) {
        finalError = e;
     }
  }

  throw new Error(`所有通道均不可用。请检查额度 (当前限制: 20次/天) 或网络。最后报错: ${finalError?.message}`);
}

// --- 官方 SDK 调用 ---
async function callOfficialGemini(historyMessages, userMessage, useTools = true) {
    const genAI = new GoogleGenerativeAI(OFFICIAL_KEY);
    const modelParams = { model: TARGET_MODEL };
    if (useTools) modelParams.tools = [{ googleSearch: {} }];
    
    const model = genAI.getGenerativeModel(modelParams);

    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    if (validHistory.length > 0 && validHistory[0].role === 'model') validHistory.shift();

    const chat = model.startChat({ history: validHistory });
    const result = await chat.sendMessage(userMessage);
    return await result.response.text();
}

// --- 第三方代理调用 ---
async function callProxyGemini(historyMessages, userMessage) {
    const contents = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    if (contents.length > 0 && contents[0].role === 'model') contents.shift();

    let baseUrl = PROXY_URL;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3);

    // 更新为 2.5
    const url = `${baseUrl}/v1beta/models/${TARGET_MODEL}:generateContent?key=${PROXY_KEY}`;

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
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("第三方返回数据格式异常: " + JSON.stringify(data));
    }
}