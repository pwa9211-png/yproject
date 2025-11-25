// lib/ai.js (Zhipu AI SDK - 最终修正)

import { ZhipuAI } from 'zhipuai'; 

// --- Zhipu AI / GLM 配置常量 ---
// 兼容之前的 GLM_API_KEY 变量
const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY; 
const ZHIPU_MODEL = 'glm-4'; 
// ------------------------

let aiClient;
let initializationError = null;

try {
    if (!ZHIPU_API_KEY) {
        throw new Error("GLM_API_KEY 或 ZHIPU_API_KEY 环境变量未设置。请在 Vercel 中设置此密钥。");
    }

    aiClient = new ZhipuAI({
        apiKey: ZHIPU_API_KEY,
    });
    console.log(`AI Client initialized using ZhipuAI SDK with model: ${ZHIPU_MODEL}`);

} catch (error) {
    initializationError = error.message;
    console.error("AI Client Initialization Error:", initializationError);
}

// 定义 Zhipu AI 的联网搜索工具结构
const WEB_SEARCH_TOOL = {
    type: 'function',
    function: {
        name: 'web_search',
        description: '用于搜索互联网以获取实时信息的搜索引擎。当需要获取新闻、热搜、天气、股价等实时信息时必须使用。',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '用于搜索的关键词' },
            },
            required: ['query'],
        },
    },
};

/**
 * 调用 AI 进行聊天补全
 * @param {Array<Object>} messages - 完整的消息历史，包括系统提示、用户消息和工具调用中间步骤
 * @returns {Promise<Object>} 返回 Zhipu API 的完整 completion 对象
 */
export async function GoogleGenAI(messages) { // 移除 aiRole 参数
    if (initializationError) {
        return { error: `对不起，AI 客户端未正确初始化。错误信息: ${initializationError}` };
    }
    if (!aiClient) {
        return { error: "对不起，AI 客户端未正确初始化。请检查 Vercel 环境变量中的 API Key。" };
    }

    try {
        const completion = await aiClient.chat.completions.create({
            model: ZHIPU_MODEL, 
            messages: messages, // 使用传入的包含系统提示的 messages 数组
            tools: [WEB_SEARCH_TOOL],
            tool_choice: "auto",
            temperature: 0.7, 
        });

        return completion;

    } catch (error) {
        console.error("Zhipu API Call Error:", error);
        return { error: `Zhipu AI 调用失败。错误详情: ${error.message}` };
    }
}