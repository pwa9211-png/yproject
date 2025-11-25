// lib/ai.js  （智谱 GLM-4 可触发联网搜索，已实测）

import { OpenAI } from 'openai';

const API_KEY   = process.env.GLM_API_KEY;
const BASE_URL  = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const MODEL     = 'glm-4';

let client, initErr;
try {
  if (!API_KEY) throw new Error('GLM_API_KEY 未设置');
  client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
} catch (e) {
  initErr = e.message;
}

/* 对外聊天函数 */
export async function GoogleGenAI(messages = [], aiRole = '万能助理') {
  if (initErr) return { error: `初始化失败：${initErr}` };
  if (!client) return { error: '客户端未就绪' };

  const sys = `你是聊天室助手，当前角色：${aiRole}。  
当前系统时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}。  
如果被问及时事/热搜/天气等，必须调用联网搜索工具。`;

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: sys },
      ...messages.map((m) => {
        // role=tool 必须保留，且 name 要与 function.name 对应
        if (m.role === 'tool') return { role: 'tool', content: m.content, name: m.name || 'web_search' };
        return { role: m.role === 'model' ? 'assistant' : m.role, content: m.text };
      }),
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: '搜索互联网实时信息',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: '搜索关键词' } },
            required: ['query'],
          },
        },
      },
    ],
    tool_choice: 'auto',
    temperature: 0.7,
  };

  try {
    const completion = await client.chat.completions.create(payload);
    return completion; // 整对象抛出，外层判断 choices[0].message.tool_calls
  } catch (e) {
    console.error('Zhipu API 错误:', e);
    return { error: e.message };
  }
}