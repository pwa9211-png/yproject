// lib/ai.js (最终版 - 集成真实网络搜索)
import { ZhipuAI } from 'zhipuai';
// --- Zhipu AI / GLM 配置常量 ---
const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
const ZHIPU_MODEL = 'glm-4';
// ------------------------
let aiClient;
let initializationError = null;
try {
    if (!ZHIPU_API_KEY) {
        throw new Error("GLM_API_KEY 或 ZHIPU_API_KEY 环境变量未设置。");
    }
    aiClient = new ZhipuAI({
        apiKey: ZHIPU_API_KEY,
    });
    console.log(`AI Client initialized using ZhipuAI SDK with model: ${ZHIPU_MODEL}`);
} catch (error) {
    initializationError = error.message;
    console.error("AI Client Initialization Error:", initializationError);
}
/**
 * 执行真正的网络搜索（使用智谱官方SDK的webSearch方法）
 * @param {string} query 搜索关键词
 * @returns {Promise<string>} 搜索结果的字符串摘要
 */
async function performWebSearch(query) {
    console.log(`[执行真实搜索] 关键词: "${query}"`);
    if (!aiClient) {
        return '搜索工具不可用，因为AI客户端未正确初始化。';
    }
    try {
        const searchResponse = await aiClient.webSearch({
            query: query,
            num: 5,
        });
        if (searchResponse && searchResponse.data && searchResponse.data.length > 0) {
            const resultsText = searchResponse.data
                .map((item, index) => `${index + 1}. ${item.title}\n   ${item.snippet}\n   链接: ${item.link}`)
                .join('\n\n');
            return `搜索结果：\n${resultsText}`;
        } else {
            return `未找到与 "${query}" 相关的搜索结果。`;
        }
    } catch (error) {
        console.error('[真实搜索] 搜索失败:', error);
        if (error.status === 401) {
            return '搜索失败：API密钥无效或已过期，请检查配置。';
        } else if (error.status === 429) {
            return '搜索失败：API请求频率过高，请稍后再试。';
        }
        return `搜索工具执行时出错: ${error.message}`;
    }
}
/**
 * 运行一个具备工具调用能力的完整对话循环
 * @param {Array<Object>} history - 消息历史（已包含系统提示）
 * @returns {Promise<string>} - 模型的最终回复内容
 */
export async function runChatWithTools(history) {
    if (initializationError) {
        return `AI 客户端初始化失败: ${initializationError}`;
    }
    // 定义工具
    const tools = [
        {
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
        },
    ];
    while (true) {
        try {
            const response = await aiClient.chat.completions.create({
                model: ZHIPU_MODEL,
                messages: history,
                tools: tools,
                tool_choice: 'auto',
            });
            const choice = response.choices[0];
            const message = choice.message;
            history.push(message);
            if (choice.finish_reason === 'tool_calls') {
                console.log('[模型思考] 请求调用工具');
                for (const toolCall of message.tool_calls) {
                    if (toolCall.function.name === 'web_search') {
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        const toolResult = await performWebSearch(functionArgs.query);
                        history.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: 'web_search',
                            content: toolResult,
                        });
                    }
                }
            } else if (choice.finish_reason === 'stop') {
                console.log('[模型完成] 返回最终答案');
                return message.content;
            } else {
                console.warn('[模型中断] 原因:', choice.finish_reason);
                return `抱歉，回复因“${choice.finish_reason}”而中断。`;
            }
        } catch (error) {
            console.error('Zhipu AI 调用失败:', error);
            return `AI 服务调用出错: ${error.message}`;
        }
    }
}
// 为了兼容，保留旧函数名
export async function GoogleGenAI(messages, aiRole) {
    return runChatWithTools(messages);
}