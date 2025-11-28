// pages/api/chat.js  2025-11-28  Kimi 主脑 + 智谱搜索工具（Key 内置）
import { connectToMongo } from '../../lib/mongodb';
import { performWebSearch, fetchSZZS, fetchSZZSHistory } from '../../lib/ai';
import { kimiChat } from '../../lib/kimi';

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS   = ['Didy', 'Shane'];
const AI_SENDER_NAME  = '万能助理';

/** 关键词预搜索判断 */
function needsSearch(text) {
  const kw = ['热搜', '天气', '股价', '上证指数', '百度', '微博', '头条', '前3条', '前三条', '新闻', '热榜'];
  return kw.some(k => text.includes(k));
}

/** 判断是否为时间查询 */
function isTimeQuery(text) {
  return /现在几点|当前时间|今天.*日期|现在.*时间/i.test(text);
}

/** 格式化系统时间（北京时间 UTC+8） */
function formatTime() {
  const now = new Date();
  const cn = new Date(now.getTime() + 8 * 3600 * 1000);
  const yyyy = cn.getUTCFullYear();
  const mm = String(cn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cn.getUTCDate()).padStart(2, '0');
  const hh = String(cn.getUTCHours()).padStart(2, '0');
  const mi = String(cn.getUTCMinutes()).padStart(2, '0');
  const ss = String(cn.getUTCSeconds()).padStart(2, '0');
  return `北京时间 ${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { room, sender, message } = req.body;
  if (!room || !sender || !message)
    return res.status(400).json({ message: 'Missing required fields.' });

  if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender))
    return res.status(403).json({ success: false, message: `房间 ${RESTRICTED_ROOM} 是限制房间。` });

  try {
    const { ChatMessage } = await connectToMongo();

    // 保存用户消息
    await ChatMessage.insertOne({ room, sender, message, role: 'user', timestamp: new Date() });

    // ❗❗❗ 只有 @万能助理 才继续 ❗❗❗
    if (!message.includes(`@${AI_SENDER_NAME}`)) {
      return res.status(200).json({ success: true, message: 'No AI trigger.' });
    }

    let aiReply;
    if (isTimeQuery(message)) {
      // ① 系统时间直接返回
      console.log('【系统时间】');
      aiReply = formatTime();
    } else if (/上证指数|szzs/i.test(message) && /\d{4}[-年]\d{1,2}[-月]\d{1,2}/.test(message)) {
      // ② 任意日期上证指数
      console.log('【任意历史行情】');
      const dateMatch = message.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);
      const date = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2,'0')}-${String(dateMatch[3]).padStart(2,'0')}`;
      const data = await fetchSZZSHistory(date);
      aiReply = data
        ? `${data.date} 上证指数收盘 ${data.close}  来源：${data.source}`
        : `未找到 ${date} 的历史数据`;
    } else if (/昨天|前天|上一交易日/i.test(message) && /上证指数|szzs/i.test(message)) {
      // ③ 昨天/前天上证指数
      console.log('【历史行情】');
      let target = new Date(Date.now() + 8 * 3600 * 1000 - 86400000);
      if (/前天/i.test(message)) target = new Date(target - 86400000);
      const date = target.toISOString().slice(0, 10);
      const data = await fetchSZZSHistory(date);
      aiReply = data
        ? `${data.date} 上证指数收盘 ${data.close}  来源：${data.source}`
        : `未找到 ${date} 的历史数据`;
    } else if (/上证指数|szzs/i.test(message)) {
      // ④ 实时上证指数
      console.log('【行情直连】');
      const data = await fetchSZZS();
      aiReply = data
        ? `上证指数 ${data.price}（${data.change > 0 ? '+' : ''}${data.change} ${data.changePercent}%） 来源：${data.source}`
        : `行情接口暂时不可用`;
    } else if (needsSearch(message)) {
      // ⑤ 需要联网 → 智谱搜索 + Kimi 总结
      console.log('【智谱搜索+Kimi总结】');
      const searchTxt = await performWebSearch(message.replace(`@${AI_SENDER_NAME}`, '').trim());
      const prompt    = `请基于以下实时信息回答，不要额外解释：\n${searchTxt}`;
      const kimians   = await kimiChat([{ role: 'user', content: prompt }]);
      aiReply         = kimians.content;
    } else {
      // ⑥ 普通对话 → Kimi 主脑
      console.log('【Kimi主脑】');
      const kimians = await kimiChat([{ role: 'user', content: message }]);
      aiReply = kimians.content;
    }

    await ChatMessage.insertOne({
      room,
      sender: AI_SENDER_NAME,
      message: aiReply,
      role: 'model',
      timestamp: new Date()
    });

    return res.status(200).json({ success: true, message: 'AI reply generated.', ai_reply: aiReply });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ success: false, message: 'AI 呼叫失败，请检查数据库和配置。', details: error.message });
  }
}