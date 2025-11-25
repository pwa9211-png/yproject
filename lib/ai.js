// lib/ai.js
// 目的：切换到智谱 GLM-4 Plus 模型，并启用其内置的联网搜索（search: true）功能。

import { OpenAI } from 'openai'; 

// 🚨 核心配置：使用智谱的 API Key 和官方 Base URL
const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'; 

let aiClient;
try {
    if (!GLM_API_KEY) {
        throw new Error("GLM_API_KEY 环境变量未设置。请设置密钥。");
    }

    // 智谱 API 兼容 OpenAI SDK
    aiClient = new OpenAI({
        apiKey: GLM_API_KEY,
        baseURL: GLM_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to GLM base URL: ${GLM_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}

/**
 * 调用 AI 进行聊天补全
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查配置。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。你正在使用智谱 GLM-4 Plus 模型，它具有联网搜索功能。如果回答需要实时信息或最新知识，请使用联网搜索。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组 (OpenAI/智谱格式)
    const finalMessages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 

    try {
        const completion = await aiClient.chat.completions.create({
            model: 'glm-4-plus', 
            messages: [
                { role: 'system', content: systemInstruction },
                ...finalMessages
            ],
            // ⭐️ 修正的关键：移除 'tools' 参数，使用 'search: true' 或 'do_sample: true'
            // 根据智谱文档，直接使用 search: true 即可开启内置搜索
            search: true, // 启用 GLM-4 的联网搜索功能
            temperature: 0.7,
        });

        const aiReply = completion.choices[0].message.content;
        
        // --- 角色命令处理保持不变 ---
        const lastUserMessage = finalMessages[finalMessages.length - 1]?.content || '';
        const roleCommandMatch = lastUserMessage.match(/^\/设定角色\s+(.+)/);

        if (roleCommandMatch) {
            return `角色设定成功，新的 AI 身份是：${roleCommandMatch[1].trim()}`;
        }
        // -----------------------------
        
        return aiReply;

    } catch (error) {
        console.error("AI 接口调用失败:", error.message);
        return `对不起，调用 GLM-4 Plus 接口失败。错误信息: ${error.message}`;
    }
}