	// lib/ai.js (最终决战版 - 完全符合智谱AI API规范)
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
	 * 执行网络搜索，并返回带链接的结果
	 */
	async function performWebSearch(query) {
	    console.log(`[工具] 执行搜索: "${query}"`);
	    try {
	        const response = await fetch(ZHIPU_SEARCH_API_URL, {
	            method: 'POST',
	            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_API_KEY}` },
	            // *** 【最终决战】使用完整的、正确的请求格式 ***
	            body: JSON.stringify({ 
	                request_id: `req-${Date.now()}`, // 添加一个唯一的请求ID
	                search_query: query,              // 搜索关键词
	                search_engine: "bing"             // 【关键】指定搜索引擎
	            }),
	        });
	        if (!response.ok) {
	            // 打印详细的错误信息
	            const errorBody = await response.text();
	            console.error('[工具] 搜索API请求失败:', response.status, errorBody);
	            throw new Error(`搜索API请求失败: ${response.status}, 详情: ${errorBody}`);
	        }
	        const data = await response.json();
	        if (!data.data || data.data.length === 0) return `未找到关于"${query}"的结果。`;
	        // 格式化结果，包含链接
	        const resultsText = data.data.map((item, i) => 
	            `来源${i + 1}: [${item.title}](${item.link})\n摘要: ${item.snippet || '无摘要'}`
	        ).join('\n\n');
	        return resultsText;
	    } catch (error) {
	        console.error('[工具] 搜索失败:', error);
	        return `搜索工具执行出错: ${error.message}`;
	    }
	}
	/**
	 * 运行对话与工具调用循环
	 */
	export async function runChatWithTools(history) {
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
	            // console.log('[AI] 模型返回的消息:', choice.message); // 生产环境可关闭以减少日志
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