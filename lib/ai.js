// lib/ai.js
// 目的：使用通用的 OpenAI SDK 兼容 Moonshot (Kimi) API 地址。

// 🚨 修正导入：使用标准的 openai 包，该包在您的 package.json 中应该已经存在。
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
        baseURL: MOONSHOT_BASE_URL, // ⭐️ 重点：这里决定了请求发送到 Kimi
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to Moonshot base URL: ${MOONSHOT_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}


/**
 * 调用 AI 进行聊天补全 (我们仍称之为 GoogleGenAI 以兼容 chat.js)
 * @param {Array<Object>} history - 聊天历史记录 (使用 {role, text} 结构)
 * @param {string} aiRole - AI 的角色设定
 * @param {Object} [options={}] - 额外的 Moonshot API 参数，例如 { tools: ['web_search'] } 🚨 新增参数
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole, options = {}) { // 🚨 接受 options 参数
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 MOONSHOT_API_KEY。";
    }

    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为兼容的 messages 数组
    const finalMessages = history.map(item => {
        let role = item.role;
        let content = item.text; // 从 text 字段取内容

        // 🚨 3. & 4. 捕获我们自定义的系统时间角色，并映射到 Moonshot 支持的 system role
        if (role === 'system_tool') {
            role = 'system';
        } else if (role === 'model') {
            role = 'assistant';
        } else {
            role = 'user';
        }

        return ({
            role: role, 
            content: content,
        });
    }).filter(m => m.content); 

    // 分离出 system/user/assistant 消息
    const systemMessages = finalMessages.filter(m => m.role === 'system');
    const userAssistantMessages = finalMessages.filter(m => m.role !== 'system');

    try {
        const completion = await aiClient.chat.completions.create({
            model: 'moonshot-v1-8k', 
            messages: [
                { role: "system", content: systemInstruction }, // 始终将角色设定放在最前面
                ...systemMessages, // 🚨 将工具或系统时间信息放在这里
                ...userAssistantMessages, // 最后放用户和助手的历史
            ].filter(m => m.content), 
            
            temperature: 0.7,
            // 🚨 4. 将 options 传递给 API 调用，包含 tools: ['web_search']
            ...options, 
        });

        // Kimi/Moonshot 的返回格式与 OpenAI 相同
        return completion.choices[0].message.content;

    } catch (error) {
        console.error("GoogleGenAI (Moonshot) API Error:", error.message);
        // 确保返回错误信息给前端
        return `对不起，调用 AI 接口失败。错误信息: ${error.message}`;
    }
}