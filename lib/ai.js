	// lib/ai.js (最终修正版 - 强化工具调用与系统提示)
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
	 * 执行网络搜索
	 */
	async function performWebSearch(query) {
	    console.log(`[工具] 执行搜索: "${query}"`);
	    try {
	        const response = await fetch(ZHIPU_SEARCH_API_URL, {
	            method: 'POST',
	            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_API_KEY}` },
	            body: JSON.stringify({ query }),
	        });
	        if (!response.ok) throw new Error(`搜索API请求失败: ${response.status}`);
	        const data = await response.json();
	        if (!data.data || data.data.length === 0) return `未找到关于"${query}"的结果。`;
	        const resultsText = data.data.map((item, i) => `${i + 1}. ${item.title}\n   ${item.snippet || '无摘要'}`).join('\n\n');
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
	    // --- 【修正关键】更简洁、更强力的系统提示 ---
	    const systemPrompt = history[0]?.content || '';
	    const refinedSystemPrompt = systemPrompt + '\n\n【严格指令】你必须严格遵守Function Calling的流程。如果需要搜索，直接调用函数，不要在回复中提及你的思考过程或函数名。';
	    history[0] = { role: 'system', content: refinedSystemPrompt };
	    console.log('[AI] 已优化系统提示');
	    const tools = [{
	        type: 'function',
	        function: {
	            name: 'web_search',
	            description: '获取实时信息，如新闻、天气、股价等',
	            parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' } }, required: ['query'] },
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