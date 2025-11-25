// lib/ai.js
// 目的：切换到智谱 GLM-4 Plus 模型，启用搜索，并注入实时时间。
import { OpenAI } from 'openai'; 

const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'; 

let aiClient;
try {
    if (!GLM_API_KEY) {
        throw new Error("GLM_API_KEY 环境变量未设置。请设置密钥。");
    }

    aiClient = new OpenAI({
        apiKey: GLM_API_KEY,
        baseURL: GLM_BASE_URL, 
    });
    console.log(`AI Client initialized: OpenAI SDK pointing to GLM base URL: ${GLM_BASE_URL}`);

} catch (error) {
    console.error("AI Client Initialization Error:", error.message);
}

function getBeijingTime() {
    const now = new Date();
    // 使用 'zh-CN' 和 'Asia/Shanghai' 获取北京时间
    return now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

export async function GoogleGenAI(history, aiRole) { 
    if (!aiClient) {
        return "对不起，AI 客户端未正确初始化。请检查配置。";
    }

    // ⭐️ 注入实时时间
    const currentTime = getBeijingTime();
    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。现在是北京时间：**${currentTime}**。你的职责是根据用户的消息和聊天历史给出相关的回复。你正在使用智谱 GLM-4 Plus 模型，它具有联网搜索功能。如果回答需要实时信息或最新知识，请使用联网搜索。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录
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
            // ⭐️ 最终修正：使用标准的 Tool Calling 格式来启用 GLM 的 web_search 功能
            tools: [{
                type: "function",
                function: {
                    name: "web_search",
                    description: "用于提供实时信息或最新新闻，以回答需要互联网数据支持的问题。",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "要搜索的内容。",
                            },
                        },
                        required: ["query"],
                    },
                },
            }],
            temperature: 0.7,
        });

        // ... (其余逻辑不变)
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