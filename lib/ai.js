// lib/ai.js
import { OpenAI } from 'openai'; 

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
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
}


/**
 * 调用 AI 进行聊天补全
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 MOONSHOT_API_KEY。";
    }

    // 系统提示：提供 AI 角色和职责
    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', 
        content: item.text,
    })).filter(m => m.content); 


    try {
        const completion = await aiClient.chat.completions.create({
            model: 'moonshot-v1-8k', // 保持您使用的模型
            messages: [
                { role: 'system', content: systemInstruction },
                ...finalMessages
            ],
            // 🚨 关键修复：不传入任何 'tools' 或 'tool_choice' 参数
            temperature: 0.7,
        });

        const aiReply = completion.choices[0].message.content;
        
        // --- 特殊命令处理 START ---
        const lastUserMessage = finalMessages[finalMessages.length - 1]?.content || '';
        // 匹配 /设定角色 [新角色描述]
        const roleCommandMatch = lastUserMessage.match(/^\/设定角色\s+(.+)/); 

        if (roleCommandMatch) {
            // 如果是角色设定命令，则返回特定的成功信息
            return `角色设定成功，新的 AI 身份是：${roleCommandMatch[1].trim()}`;
        }
        // --- 特殊命令处理 END ---
        
        return aiReply;

    } catch (error) {
        console.error("AI 接口调用失败:", error.message);
        return `对不起，调用 AI 接口失败。错误信息: ${error.message}`;
    }
}