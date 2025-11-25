// lib/ai.js  (完整版 – 修复 eof 报错，保留工具调用两次交互能力)

import { OpenAI } from 'openai';

/* ---------- 智谱 GLM-4 配置 ---------- */
const ZHIPU_API_KEY   = process.env.GLM_API_KEY;
const ZHIPU_BASE_URL  = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const ZHIPU_MODEL     = 'glm-4';

let aiClient;
let initError = null;

/* ====== 客户端初始化 ====== */
try {
  if (!ZHIPU_API_KEY) throw new Error('GLM_API_KEY 环境变量未设置');
  aiClient = new OpenAI({ apiKey: ZHIPU_API_KEY, baseURL: ZHIPU_BASE_URL });
} catch (e) {
  initError = e.message;
  console.error('AI Client Init Error:', initError);
}

/* ====== 对外暴露的聊天函数 ====== */
export async function GoogleGenAI(history = [], aiRole = '万能助理') {
  if (initError) return { error: `AI 初始化失败：${initError}` };
  if (!aiClient) return { error: 'AI 客户端未就绪' };

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const systemPrompt = `你是聊天室内的多功能助手。
- 当前角色：${aiRole}
- 系统时间：${now}
- 你已获准使用联网搜索工具（web_search）。
- 若被问及时事/热搜/天气/股价等，必须调用工具搜索，不得拒绝。
- 用户可用“/设定角色”命令让你切换身份。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    })),
  ];

  /* ---- 第一次调用：让模型决定是否调用工具 ---- */
  try {
    const completion = await aiClient.chat.completions.create({
      model: ZHIPU_MODEL,
      messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: '搜索互联网以获取实时信息',
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
      tool_choice: 'auto',
      temperature: 0.7,
    });

    /* 返回完整对象，外层 chat.js 据此判断是工具调用还是直接回复 */
    return completion;
  } catch (e) {
    console.error('Zhipu API 调用失败:', e);
    return { error: `Zhipu API 调用失败：${e.message}` };
  }
}