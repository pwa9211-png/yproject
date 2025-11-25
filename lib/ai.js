	// lib/ai.js  【GLM-4 聊天：启用工具调用实现联网搜索】
	import { OpenAI } from 'openai';
	const API_KEY  = process.env.GLM_API_KEY;
	const BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
	const MODEL    = 'glm-4'; // 确保使用支持工具调用的模型，如 glm-4
	let client, initErr;
	try {
	  if (!API_KEY) throw new Error('GLM_API_KEY 未设置');
	  client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
	} catch (e) {
	  initErr = e.message;
	}
	/**
	 * 调用 GLM-4 并启用联网搜索工具
	 * @param {Array<Object>} history       历史消息 [{role, text}]
	 * @param {string}        aiRole        助手角色
	 * @returns {Promise<Object>}           完整 completion
	 */
	export async function GoogleGenAI(history, aiRole = '万能助理') {
	  if (initErr) return { error: `初始化失败：${initErr}` };
	  if (!client) return { error: '客户端未就绪' };
	  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
	  const systemPrompt = `你是聊天室助手，当前角色：${aiRole}。
	系统时间：${now}。
	对于需要实时信息或超出知识库范围的问题，请使用网络搜索工具获取信息。`;
	  const payload = {
	    model: MODEL,
	    messages: [
	      { role: 'system', content: systemPrompt },
	      ...history.map((m) => ({
	        role: m.role === 'model' ? 'assistant' : m.role,
	        content: m.text,
	      })),
	    ],
	    temperature: 0.7,
	    // === 关键修改部分：添加 tools 参数 ===
	    tools: [
	      {
	        type: 'function',
	        function: {
	          name: 'web_search_pro',
	          description: '互联网搜索，用于获取实时信息。当用户的问题涉及实时性、未知事实或需要网络信息时，调用此工具。',
	          parameters: {
	            type: 'object',
	            properties: {
	              search_query: { type: 'string', description: '需要搜索的关键词或问题' },
	            },
	            required: ['search_query'],
	          },
	        },
	      },
	    ],
	    // 部分平台可能需要指定 tool_choice 来强制或建议使用工具，例如："tool_choice": "auto"
	  };
	  try {
	    return await client.chat.completions.create(payload);
	  } catch (e) {
	    console.error('Zhipu API 错误:', e);
	    return { error: e.message };
	  }
	}