// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Zhipu (智谱) API 地址。

import { OpenAI } from 'openai'; 

// 严格要求使用 Zhipu 配置
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY; 
// 关键：将 baseURL 设置为 Zhipu 的 API 地址 (使用 V4 接口)
const ZHIPU_BASE_URL = process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/'; 

let aiClient;
try {
    if (!ZHIPU_API_KEY) {
        // 修复问题 2：修改错误提示信息
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
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        // 修复问题 2：返回 Zhipu 相关的错误提示
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 ZHIPU_API_KEY。";
    }

    // 修复问题 5：确保 AI 能调用现在时间
    const now = new Date().toLocaleString('zh-CN', { 
        year: 'numeric', month: 'numeric', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。当前时间是：${now}。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => ({
        // Zhipu API 的角色是 user/assistant/system
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 


    try {
        const completion = await aiClient.chat.completions.create({
            // 使用 Zhipu 的 glm-4 模型，它支持联网
            model: 'glm-4', 
            messages: [
                { role: 'system', content: systemInstruction },
                ...finalMessages
            ],
            // 修复问题 6：启用联网搜索 (使用 Zhipu 的 web_search 工具)
            tools: [{ type: "web_search", web_search: { enable: true } }],
        });

        // 检查返回内容，智谱API可能返回 tools 调用的响应，这里只取纯文本内容
        const aiMessage = completion.choices[0].message;
        const aiReply = aiMessage.content;
        
        return aiReply || "AI 没有返回内容，可能是由于 Tool Call 或其他原因。";

    } catch (error) {
        console.error('Zhipu AI Call Error:', error);
        if (error.status === 401) {
             return "AI 调用失败：API 密钥无效或未授权。请检查 ZHIPU_API_KEY。";
        }
        return `AI 调用失败：${error.message || '未知错误'}`;
    }
}