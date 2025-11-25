// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Zhipu (智谱) API 地址。

import { OpenAI } from 'openai'; 

// 严格要求使用 Zhipu 配置
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
// 关键：将 baseURL 设置为 Zhipu 的 API 地址
const ZHIPU_BASE_URL = process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'; 

let aiClient;
try {
    if (!ZHIPU_API_KEY) {
        // 使用智谱的 key 而不是 MOONSHOT_API_KEY
        throw new Error("ZHIPU_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    // 使用 OpenAI 客户端，但指向 Zhipu 的 API 地址
    aiClient = new OpenAI({
        apiKey: ZHIPU_API_KEY,
        baseURL: ZHIPU_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to Zhipu base URL: ${ZHIPU_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}


/**
 * 调用 AI 进行聊天补全 (我们仍称之为 GoogleGenAI 以兼容 chat.js)
 * @param {Array<Object>} history - 聊天历史记录 (格式: [{ role: 'user'|'model', text: '...' }])
 * @param {string} aiRole - AI 的角色设定 (例如: '万能助理')
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 ZHIPU_API_KEY。";
    }

    // ⭐️ 简化角色设定，避免复杂逻辑干扰上下文
    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。`;
    
    // 格式化历史记录为兼容的 messages 数组 (注意：role 必须是 'user' 或 'assistant')
    const finalMessages = history.map(item => ({
        // 确保 'model' 转换为 'assistant'
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 
    
    // 确保 system instruction 在第一个位置
    const messages = [
        { role: 'system', content: systemInstruction },
        ...finalMessages,
    ];

    try {
        const completion = await aiClient.chat.completions.create({
            // ⭐️ 切换到智谱的模型名称
            model: 'glm-4', // 推荐使用智谱的 glm-4 模型
            messages: messages,
            stream: false, // 暂时禁用流式传输以简化逻辑
        });

        const aiReply = completion.choices[0].message.content.trim();
        return aiReply;

    } catch (error) {
        console.error("Zhipu API Call Error:", error.message);
        return `AI 调用失败。错误信息：${error.message}`;
    }
}