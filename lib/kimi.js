// lib/kimi.js  2025-11-28  Kimi 主脑（Key 内置）
import { OpenAI } from 'openai';

const kimi = new OpenAI({
  apiKey: 'sk-b536gEEnuYNHi9EcNErTC9SHRKUvodyqRXsGWAQuZGAE4Nz8',
  baseURL: 'https://api.moonshot.cn/v1',
});

export async function kimiChat(messages, tools = null) {
  const res = await kimi.chat.completions.create({
    model: 'kimi-latest',
    messages,
    tools,
    temperature: 0.3,
  });
  return res.choices[0].message;
}