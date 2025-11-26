// lib/ai.js (调试监听版 - 打印API请求和响应的详细内容)

import { ZhipuAI } from 'zhipuai';

// --- 配置 ---
const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
const ZHIPU_MODEL = 'glm-4';
const ZHIPU_SEARCH_API_URL = 'https://open.bigmodel.cn/api/paas/v4/web_search';

// --- 初始化 ---
let aiClient;
try {
    if (!ZHIPU_API_KEY) throw new Error("API Key 未设置。");
    aiClient = new ZhipuAI({ apiKey: ZHIPU_API_KEY });
    console.log(`[AI] ZhipuAI SDK (${ZHIPU_MODEL}) 初始化成功`);
} catch (error) {
    console.error('[AI] 初始化失败:', error.message);
}

/**
 * 【调试监听版】执行网络搜索
 * 打印详细的请求和响应，用于问题排查。
 */
async function performWebSearch(query) {
    console.log(`[工具调试日志] 准备执行网络搜索，查询词: "${query}"`);

    const requestBody = {
        search_query: query,
        search_engine: "search_std", // 我们先锁定用这个，看看它到底返回什么
        search_intent: false,
        count: 5, 
    };

    console.log(`[工具调试日志] 准备发送的请求体:`, JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch(ZHIPU_SEARCH_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ZHIPU_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`[工具调试日志] API请求失败: ${response.status}`, JSON.stringify(errorData, null, 2));
            return `搜索API请求失败: ${response.status}, 详情: ${JSON.stringify(errorData)}`;
        }

        const data = await response.json();
        console.log('[工具调试日志] API请求成功，收到的原始响应数据:', JSON.stringify(data, null, 2));

        if (!data.search_result || data.search_result.length === 0) {
            console.log('[工具调试日志] 响应中没有搜索结果。');
            return `很抱歉，没有找到关于 "${query}" 的相关信息。`;
        }

        let formattedResults = data.search_result.map((item, index) => {
            return `来源${index + 1}: [${item.title}](${item.link})\n摘要: ${item.content}`;
        }).join('\n\n');

        console.log(`[工具调试日志] 格式化后，返回给AI的结果。`);
        return formattedResults;

    } catch (error) {
        console.error('[工具调试日志] 请求发生网络错误:', error);
        return `搜索请求失败: ${error.message}`;
    }
}

/**
 * 运行对话与工具调用循环 (此部分保持不变)
 */
export async function runChatWithTools(history) {
    // ... (此函数与上一个版本完全相同，为了简洁我这里省略了，请直接从上个版本复制)
    console.log('[AI] 对话开始，历史消息数:', history.length);

    const originalSystemPrompt = history.find(m => m.role === 'system')?.content || '';
    const newSystemPrompt = `${originalSystemPrompt}

【强制性事实核查协议 - 严格遵守】
1.  【知识过时警告】：你的内部知识库存在严重的时间滞后性，所有涉及“现在”、“今天”、“最新”等实时性的事实信息都是不可靠的。
2.  【强制工具调用】：对于任何问题，只要它涉及当前日期和时间之后的事件、新闻、天气、股价、指数、数据，你**必须**调用 'web_search' 工具进行搜索。绝对禁止猜测或使用内部知识回答。
3.  【禁止信息混合】：你只能使用 'web_search' 工具返回的结果来构建你的答案。严禁将工具结果与你的内部知识混合，或修改工具结果中的事实性数据。
4.  【来源引用】：在你的回答结尾，必须附上你所用信息的来源链接。格式如：信息来源：[链接地址]。
5.  【执行流程】：如果需要搜索，请调用工具。收到工具结果后，直接基于该结果回答并附上来源。如果问题不涉及实时事实（例如“你好”、“什么是光合作用”），可以正常回答。`;
    
    if (history.length > 0 && history[0].role === 'system') {
        history[0].content = newSystemPrompt;
    } else {
        history.unshift({ role: 'system', content: newSystemPrompt });
    }
    
    console.log('[AI] 已加载强制性事实核查协议');

    const tools = [{
        type: 'function',
        function: {
            name: 'web_search',
            description: '获取实时、最新的网络信息，是回答事实性问题的唯一可靠途径。',
            parameters: { type: 'object', properties: { query: { type: 'string', description: '用于搜索的精确关键词' } }, required: ['query'] },
        },
    }];

    for (let attempt = 1; attempt <= 5; attempt++) {
        console.log(`[AI] --- 第 ${attempt} 轮对话 ---`);
        try {
            const response = await aiClient.chat.completions.create({
                model: ZHIPU_MODEL,
                messages: history,
                tools: tools,
                tool_choice: 'auto',
                temperature: 0, 
            });

            const choice = response.choices[0];
            console.log('[AI] 模型返回 finish_reason:', choice.finish_reason);

            if (!choice.message) {
                console.error('[AI] 严重错误: API响应中缺少message');
                return "后端错误：API返回数据不完整。";
            }
            history.push(choice.message);

            if (choice.finish_reason === 'tool_calls') {
                console.log('[AI] 模型请求调用工具:', choice.message.tool_calls);
                for (const toolCall of choice.message.tool_calls) {
                    if (toolCall.function.name === 'web_search') {
                        const { query } = JSON.parse(toolCall.function.arguments);
                        const toolResult = await performWebSearch(query); 
                        history.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: 'web_search',
                            content: toolResult,
                        });
                    }
                }
            } else if (choice.finish_reason === 'stop') {
                const finalReply = choice.message.content || '（AI返回了空内容）';
                console.log('[AI] 对话结束，最终回复:', finalReply);
                return finalReply;
            } else {
                console.warn('[AI] 对话因其他原因中断:', choice.finish_reason);
                return `对话中断: ${choice.finish_reason}`;
            }
        } catch (error) {
            console.error(`[AI] 第 ${attempt} 轮调用失败:`, error);
            if (attempt === 5) return `服务多次调用失败: ${error.message}`;
        }
    }
    return '服务异常：对话循环超时。';
}

export async function GoogleGenAI(messages) {
    return runChatWithTools(messages);
}