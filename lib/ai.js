// lib/ai.js  【GLM-4 聊天：系统提示里嵌入实时搜索结果】
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

/**
 * 调用 GLM-4
 * @param {Array<Object>} history       历史消息 [{role, text}]
 * @param {string}        aiRole        助手角色
 * @param {string}        searchResult  实时搜索摘要（可选）
 * @returns {Promise<Object>}           完整 completion
 */
export async function GoogleGenAI(history, aiRole = '万能助理', searchResult = '') {
  if (initErr) return { error: `初始化失败：${initErr}` };
  if (!client) return { error: '客户端未就绪' };

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const systemPrompt = `你是聊天室助手，当前角色：${aiRole}。
系统时间：${now}。
下方“实时网页搜索结果”仅供参考，请基于它给出简洁准确的回复。

实时网页搜索结果：
${searchResult || '（无）'}

请继续正常对话。`;

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
  };

  try {
    return await client.chat.completions.create(payload);
  } catch (e) {
    console.error('Zhipu API 错误:', e);
    return { error: e.message };
  }
}