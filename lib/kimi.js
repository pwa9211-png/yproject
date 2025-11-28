// lib/kimi.js  2025-11-28  最终版：仅 catch 429，不降级智谱
import { OpenAI } from 'openai';

const kimi = new OpenAI({
  apiKey: 'sk-b536gEEnuYNHi9EcNErTC9SHRKUvodyqRXsGWAQuZGAE4Nz8',
  baseURL: 'https://api.moonshot.cn/v1',
});

export async function kimiChat(messages, tools = null) {
  try {
    const res = await kimi.chat.completions.create({
      model: 'kimi-latest',
      messages,
      tools,
      temperature: 0.3,
    });
    return res.choices[0].message;
  } catch (e) {
    if (e.status === 429 || e.type === 'engine_overloaded_error') {
      console.log('【Kimi 429 提示用户】');
      return {
        content: 'Kimi 引擎繁忙，请 10 秒后重试。',
        role: 'assistant',
      };
    }
    throw e; // 其它错误继续抛
  }
}