// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Moonshot (Kimi) API 地址。

import { OpenAI } from 'openai'; 

// 严格要求使用 Moonshot 配置
const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
// 关键：将 baseURL 设置为 Moonshot 的 API 地址
const MOONSHOT_BASE_URL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'; 

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
    // 客户端初始化失败，但继续运行，将在调用时返回错误
}


/**
 * 调用 AI 进行聊天补全 
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { // 保持函数名为 GoogleGenAI 以兼容 chat.js
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 MOONSHOT_API_KEY。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为 Moonshot/OpenAI 兼容的 messages 数组
    const finalMessages = history.map(item => ({
        // 修正：将后端传来的 'model' 角色映射为 'assistant'
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); // 过滤空消息


    try {
        const completion = await aiClient.chat.completions.create({
            // 确保 model 是 Kimi 的模型名称
            model: 'moonshot-v1-8k', 
            messages: [
                { role: "system", content: systemInstruction },
                ...finalMessages,
            ],
            // 允许流式响应，尽管我们在这里只返回最终结果
            stream: false,
        });
        
        // 检查是否有回复
        if (completion.choices && completion.choices.length > 0) {
            const aiText = completion.choices[0].message.content;
            return aiText;
        }

        return "对不起，AI API 返回了空回复。";

    } catch (error) {
        console.error("Moonshot/AI API 调用出错:", error);
        return `AI 调用失败：${error.message}。请检查 API Key 和网络连接。`;
    }
}