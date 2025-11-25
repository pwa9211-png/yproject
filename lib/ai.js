// lib/ai.js
// 目的：使用通用代理地址和 OpenAI SDK 调用兼容 Gemini 的模型。
import { OpenAI } from 'openai'; 

// 1. 从环境变量获取配置。如果没有设置，则使用您的默认值。
// 
// 强烈建议在 Vercel 或 .env.local 中设置 PROXY_API_KEY 和 PROXY_BASE_URL
const PROXY_API_KEY = process.env.PROXY_API_KEY || 'sk-z3NmECLz1x4If99qOOaJr6pvEoKPwNIB5kdoSjlfqjcpEFt2';
// ⭐️ 采纳推荐的 BASE_URL 格式：https://xinyuanai666.com/v1
const PROXY_BASE_URL = process.env.PROXY_BASE_URL || 'https://xinyuanai666.com/v1'; 

let aiClient;
try {
    if (!PROXY_API_KEY) {
        throw new Error("PROXY_API_KEY 环境变量未设置。请设置密钥。");
    }

    // 关键：使用 OpenAI 客户端，但指向您的代理地址
    aiClient = new OpenAI({
        apiKey: PROXY_API_KEY,
        baseURL: PROXY_BASE_URL, // ⭐️ 使用推荐的包含 /v1 的地址
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to Proxy base URL: ${PROXY_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}


/**
 * 调用 AI 进行聊天补全
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { // 保持函数名不变以兼容 chat.js
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查配置。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。你正在使用一个兼容 OpenAI 接口的 Gemini 模型 (Gemini 2.5 Flash)。如果用户认为需要联网搜索来回答问题，请尽力使用模型的内置联网能力。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', // OpenAI 格式
        content: item.text,
    })).filter(m => m.content); 

    try {
        const completion = await aiClient.chat.completions.create({
            // 🚨 关键：模型名称设置为 Gemini 2.5 Flash
            model: 'gemini-2.5-flash', 
            messages: [
                { role: 'system', content: systemInstruction },
                ...finalMessages
            ],
            // **不**传入 tools 参数，因为通用代理可能不支持 Gemini 的原生工具格式。
            temperature: 0.7,
        });

        const aiReply = completion.choices[0].message.content;
        
        // --- 特殊命令处理 START ---
        const lastUserMessage = finalMessages[finalMessages.length - 1]?.content || '';
        const roleCommandMatch = lastUserMessage.match(/^\/设定角色\s+(.+)/);

        if (roleCommandMatch) {
            return `角色设定成功，新的 AI 身份是：${roleCommandMatch[1].trim()}`;
        }
        // --- 特殊命令处理 END ---
        
        return aiReply;

    } catch (error) {
        console.error("AI 接口调用失败:", error.message);
        // 如果是 400 错误，直接返回更友好的错误信息
        return `对不起，调用 AI 接口失败。错误信息: ${error.message} (请检查代理地址、API Key 或模型名称是否正确)`;
    }
}