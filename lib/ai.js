// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Moonshot (Kimi) API 地址。

import { OpenAI } from 'openai'; 

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
// 关键：将 baseURL 设置为 Moonshot 的 API 地址
const MOONSHOT_BASE_URL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'; 
const AI_MODEL = 'moonshot-v1-8k'; // Kimi 的模型名称

let aiClient;
try {
    if (!MOONSHOT_API_KEY) {
        throw new Error("MOONSHOT_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    // 使用 OpenAI 客户端，但指向 Moonshot 的 API 地址
    aiClient = new OpenAI({
        apiKey: MOONSHOT_API_KEY,
        baseURL: MOONSHOT_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to Moonshot base URL: ${MOONSHOT_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}


/**
 * 调用 AI 进行聊天补全 (我们仍称之为 GoogleGenAI 以兼容 chat.js)
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 MOONSHOT_API_KEY。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 


    try {
        const completion = await aiClient.chat.completions.create({
            model: AI_MODEL, 
            messages: [
                { role: "system", content: systemInstruction },
                ...finalMessages, // 插入历史消息和当前用户消息
            ],
            temperature: 0.7,
        });

        const reply = completion.choices[0].message.content.trim();

        // 检查角色设定命令并返回特定回复
        if (finalMessages[finalMessages.length - 1]?.content.startsWith('/设定角色')) {
            return "角色设定成功。我已记住新的角色描述。";
        }
        
        return reply;

    } catch (error) {
        console.error("AI API Call Error:", error);
        return `对不起，调用 AI 服务时发生错误：${error.message}`;
    }
}