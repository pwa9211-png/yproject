// lib/ai.js  【GLM-4 启用联网工具，官方格式】
import { OpenAI } from 'openai';

const API_KEY  = process.env.GLM_API_KEY;
const BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const MODEL    = 'glm-4';

let client, initErr;
try {
  if (!API_KEY) throw new Error('GLM_API_KEY 未设置');
  client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
} catch (e) {
  initErr = e.message;
}

export async function GoogleGenAI(history = [], aiRole = '万能助理') {
  if (initErr) return { error: `初始化失败：${initErr}` };
  if (!client) return { error: '客户端未就绪' };

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const systemPrompt = `你是聊天室助手，当前角色：${aiRole}。
系统时间：${now}。
若用户问的是时事、热搜、天气、股价等实时信息，你必须调用 web_search 工具，不得直接拒绝。`;

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.text,
      })),
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: '互联网搜索，用于获取实时信息',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词' },
            },
            required: ['query'],
          },
        },
      },
    ],
    tool_choice: 'auto',   // 显式让模型自己选
    temperature: 0.7,
  };

  try {
    return await client.chat.completions.create(payload);
  } catch (e) {
    console.error('Zhipu API 错误:', e);
    return { error: e.message };
  }
}