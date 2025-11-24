// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Moonshot (Kimi) API 地址。

import { OpenAI } from 'openai'; 

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const MOONSHOT_BASE_URL = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'; 

let aiClient;
try {
    if (!MOONSHOT_API_KEY) {
        throw new Error("MOONSHOT_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    aiClient = new OpenAI({
        apiKey: MOONSHOT_API_KEY,
        baseURL: MOONSHOT_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to Moonshot base URL: ${MOONSHOT_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}


/**
 * 调用 AI 进行聊天补全 (兼容 Moonshot)
 * @param {Array<Object>} history - 聊天历史记录 (使用 {role, text} 结构)
 * @param {string} aiRole - AI 的角色设定
 * @param {Object} [options={}] - 额外的 Moonshot API 参数，例如 { tools: [{ type: "web_search" }] }
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole, options = {}) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 MOONSHOT_API_KEY。";
    }

    // 🚨 核心修复：将角色设定和系统工具信息都放在系统指令中
    // 这样可以确保角色和时间工具信息在对话开始前就被模型接收
    let systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => {
        let role = item.role;
        let content = item.text; 

        // 🚨 修复点：捕获我们自定义的系统时间角色 (system_tool)，并将其内容添加到 systemInstruction 中
        // 这样可以避免将它作为普通消息发送，同时保证它在系统层级生效
        if (role === 'system_tool') {
             // 检查是否已经包含了时间信息，避免重复添加
             if (!systemInstruction.includes('系统工具输出：当前服务器的准确时间是')) {
                systemInstruction += `\n\n[工具信息]\n${content}`; // 将时间信息附加到系统指令
             }
             return null; // 过滤掉这条消息，不作为独立消息发送
        }
        
        // 正常的角色映射
        if (role === 'model') {
            role = 'assistant';
        } else {
            role = 'user';
        }

        return ({
            role: role, 
            content: content,
        });
    }).filter(m => m !== null && m.content); 


    try {
        const completion = await aiClient.chat.completions.create({
            model: 'moonshot-v1-8k', 
            messages: [
                { role: "system", content: systemInstruction }, // 始终将角色设定（包含工具信息）放在最前面
                ...finalMessages, // 最后放用户和助手的历史
            ].filter(m => m.content), 
            
            temperature: 0.7,
            ...options, // 包含 tools: [{ type: "web_search" }]
        });

        return completion.choices[0].message.content;

    } catch (error) {
        console.error("GoogleGenAI (Moonshot) API Error:", error.message);
        return `对不起，调用 AI 接口失败。错误信息: ${error.message}`;
    }
}