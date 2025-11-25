// lib/ai.js (调整：支持工具调用的两次交互)

import { OpenAI } from 'openai'; 

// --- Zhipu AI / GLM 配置常量 ---
const ZHIPU_API_KEY = process.env.GLM_API_KEY; 
const ZHIPU_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'; 
const ZHIPU_MODEL = 'glm-4'; 
// ------------------------

let aiClient;
let initializationError = null;

try {
    if (!ZHIPU_API_KEY) {
        throw new Error("GLM_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    aiClient = new OpenAI({
        apiKey: ZHIPU_API_KEY,
        baseURL: ZHIPU_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to URL: ${ZHIPU_BASE_URL} with model: ${ZHIPU_MODEL}`);

} catch (error) {
    initializationError = error.message;
    console.error("AI Client Initialization Error:", initializationError);
}

/**
 * 调用 AI 进行聊天补全
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<Object|string>} 返回完整的 Completion 对象
 */
export async function GoogleGenAI(history, aiRole) { 
    if (initializationError) {
        return `对不起，AI 客户端未正确初始化。错误信息: ${initializationError}`;
    }
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 GLM_API_KEY。";
    }

    // 获取当前时间
    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    // 注入 System Prompt，加强对工具的使用指令
    const systemInstruction = `你是一个多功能聊天室里的助手。
    - 你的当前角色是: ${aiRole}。
    - 当前系统时间是: ${currentTime}。
    - 你被授权访问联网搜索工具（web_search）。
    - 你的职责是根据用户的消息和聊天历史给出相关的回复。
    - **【重要】如果用户询问即时信息（如新闻、热搜、天气、股价等），你必须利用