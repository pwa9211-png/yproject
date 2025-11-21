// lib/ai.js
// 目的：在中国大陆环境下，仅使用 Moonshot (Kimi) 客户端。

import { MoonshotClient } from '@moonshot-ai/api';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const MOONSHOT_BASE_URL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'; // 默认值

let aiClient;
try {
    if (!MOONSHOT_API_KEY) {
        throw new Error("MOONSHOT_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    aiClient = new MoonshotClient({
        apiKey: MOONSHOT_API_KEY,
        baseURL: MOONSHOT_BASE_URL,
    });
    console.log(`AI Client initialized: Moonshot (Kimi) using base URL: ${MOONSHOT_BASE_URL}`);
} catch (error) {
    console.error("Moonshot Client Initialization Error:", error.message);
    // 客户端初始化失败，但继续运行，将在调用时返回错误
}


/**
 * 调用 Moonshot (Kimi) 进行聊天补全
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 MOONSHOT_API_KEY。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为 Moonshot 兼容的 messages 数组
    const finalMessages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', // Moonshot 使用 assistant
        content: item.text,
    })).filter(m => m.content); // 过滤空消息


    try {
        // --- Moonshot 客户端调用 ---
        const completion = await aiClient.chat.completions.create({
            model: 'moonshot-v1-8k', // 使用 Moonshot 模型
            messages: [
                { role: "system", content: systemInstruction },
                ...finalMessages
            ],
            temperature: 0.7,
        });

        return completion.choices[0].message.content || "AI 没有返回内容。";
        
    } catch (error) {
        console.error("Moonshot API Call Error:", error);
        return `AI 回复出错：API 调用失败或响应格式错误。 (${error.message})`;
    }
}