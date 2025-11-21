// lib/ai.js
// 目的：使用标准的 OpenAI SDK 连接 Moonshot (Kimi) API，确保稳定性和 CN 访问。

import OpenAI from 'openai'; // 🚨 使用稳定的 openai 包

// 严格要求使用 Moonshot 配置
const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
// Moonshot API 是 OpenAI 兼容的，我们通过 baseURL 指定其端点
const MOONSHOT_BASE_URL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'; 

let aiClient;
try {
    if (!MOONSHOT_API_KEY) {
        console.error("MOONSHOT_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    // 初始化 OpenAI 客户端，指定 Moonshot 的 API 端点
    aiClient = new OpenAI({
        apiKey: MOONSHOT_API_KEY,
        baseURL: MOONSHOT_BASE_URL, 
    });
    console.log(`AI Client initialized: Moonshot (Kimi) via OpenAI SDK, base URL: ${MOONSHOT_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}


/**
 * 调用 Moonshot (Kimi) 进行聊天补全 (OpenAI 兼容模式)
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { // 保持函数名为 GoogleGenAI 以兼容 chat.js
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 MOONSHOT_API_KEY 是否已设置。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为 OpenAI/Moonshot 兼容的 messages 数组
    const finalMessages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 


    try {
        // --- Moonshot 客户端调用 (OpenAI 兼容) ---
        const completion = await aiClient.chat.completions.create({
            model: 'moonshot-v1-8k', // 使用 Moonshot 模型
            messages: [
                { role: "system", content: systemInstruction },
                ...finalMessages
            ],
            temperature: 0.7,
        });
        
        const reply = completion.choices[0].message.content;
        
        if (reply.trim() === '') {
            return "AI 回复为空。";
        }
        
        return reply;
        
    } catch (error) {
        console.error("Moonshot Generation Error:", error);
        return `对不起，Moonshot 模型调用失败。错误信息：${error.message}`;
    }
}