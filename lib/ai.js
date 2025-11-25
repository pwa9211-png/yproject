// lib/ai.js (兼容 zhipuai SDK v2.0.0 的最终版)

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
    console.log(`AI Client initialized using ZhipuAI SDK v2.0.0 with model: ${ZHIPU_MODEL}`);

} catch (error) {
    initializationError = error.message;
    console.error("AI Client Initialization Error:", initializationError);
}

/**
 * 【兼容 v2.0.0】通过直接调用搜索API来执行网络搜索
 * @param {string} query 搜索关键词
 * @returns {Promise<string>} 搜索结果的字符串摘要
 */
async function performWebSearch(query) {
    console.log(`[执行API搜索] 关键词: "${query}"`);

    if (!ZHIPU_API_KEY) {
        return '搜索失败：API Key 未配置。';
    }

    try {
        // 直接调用智谱AI的独立网络搜索API端点
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/web_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZHIPU_API_KEY}`
            },
            body: JSON.stringify({
                query: query,
                // v2.0.0 搜索API可能不直接支持分页，或参数不同，先使用最基本的参数
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[API搜索] 请求失败:', response.status, errorData);
            throw new Error(`搜索API请求失败: ${response.status} ${errorData.error?.message || '未知错误'}`);
        }

        const data = await response.json();

        // 检查并格式化搜索结果
        if (data && data.data && data.data.length > 0) {
            const resultsText = data.data
                .map((item, index) => `${index + 1}. ${item.title}\n   ${item.snippet || item.content || '无摘要'}\n   链接: ${item.link}`)
                .join('\n\n');
            return `搜索结果：\n${resultsText}`;
        } else {
            return `未找到与 "${query}" 相关的搜索结果。`;
        }
    } catch (error) {
        console.error('[API搜索] 执行失败:', error);
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

    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
        loopCount++;
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
                console.log(`[模型思考] 第${loopCount}轮：请求调用工具`);
                for (const toolCall of message.tool_calls) {
                    if (toolCall.function.name === 'web_search') {
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        // 调用我们新写的、基于API的搜索函数
                        const toolResult = await performWebSearch(functionArgs.query);
                        
                        history.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: 'web_search',
                            content: toolResult,
                        });
                    }
                }
                continue;
            } else if (choice.finish_reason === 'stop') {
                console.log(`[模型完成] 在第${loopCount}轮返回最终答案`);
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

    return '抱歉，处理您的请求时循环次数过多，已自动中断以防止错误。';
}

// 为了兼容，保留旧函数名
export async function GoogleGenAI(messages, aiRole) {
    return runChatWithTools(messages);
}