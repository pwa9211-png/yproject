// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Zhipu AI (智谱) API 地址。

import { OpenAI } from 'openai'; 

// --- Zhipu AI 配置常量 ---
// 从 Vercel 环境变量中获取 Zhipu 密钥
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
// Zhipu API 的基准 URL (最新版本)
const ZHIPU_BASE_URL = process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'; 
// 使用智谱的主流模型
const ZHIPU_MODEL = 'glm-4'; 
// ------------------------

let aiClient;
let initializationError = null;

try {
    if (!ZHIPU_API_KEY) {
        // 如果密钥不存在，抛出明确的错误
        throw new Error("ZHIPU_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    // 使用 OpenAI 客户端，但指向 Zhipu 的 API 地址
    aiClient = new OpenAI({
        apiKey: ZHIPU_API_KEY,
        baseURL: ZHIPU_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to Zhipu base URL: ${ZHIPU_BASE_URL} with model: ${ZHIPU_MODEL}`);

} catch (error) {
    initializationError = error.message;
    console.error("AI Client Initialization Error:", initializationError);
}


/**
 * 调用 AI 进行聊天补全 (我们仍称之为 GoogleGenAI 以兼容 chat.js)
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (initializationError) {
        return `对不起，AI 客户端未正确初始化。错误信息: ${initializationError}`;
    }
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 ZHIPU_API_KEY。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => ({
        // 将内部 role 映射到 OpenAI/Zhipu 兼容的 role
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 


    try {
        const completion = await aiClient.chat.completions.create({
            model: ZHIPU_MODEL, // 使用智谱的模型
            messages: [
                { role: "system", content: systemInstruction },
                ...finalMessages
            ],
            temperature: 0.7, // 适当的随机性
        });

        const aiReply = completion.choices[0].message.content;
        return aiReply || "AI 没有返回任何内容。";

    } catch (error) {
        console.error("Zhipu API Call Error:", error);
        return `Zhipu AI 调用失败。错误详情: ${error.message}`;
    }
}