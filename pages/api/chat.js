// pages/api/chat.js  【系统时间+实时行情版-2025-11-26】
import { connectToMongo } from '../../lib/mongodb';
import { runChatWithTools, performWebSearch } from '../../lib/ai';

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS   = ['Didy', 'Shane'];
const AI_SENDER_NAME  = '万能助理';

/** 关键词预搜索判断（不含时间类） */
function needsSearch(text) {
  const kw = ['热搜', '天气', '股价', '上证指数', '百度', '微博', '头条', '前3条', '前三条'];
  return kw.some(k => text.includes(k));
}

/** 判断是否为时间查询 */
function isTimeQuery(text) {
  return /现在几点|当前时间|今天.*日期|现在.*时间/i.test(text);
}

/** 格式化系统时间（北京时间） */
function formatTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `【已联网】北京时间 ${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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
    } else if (needsSearch(message)) {
      // ② 行情/热搜等 → 预搜索
      console.log('【预搜索触发】');
      const query   = message.replace(`@${AI_SENDER_NAME}`, '').trim();
      const searchTxt = await performWebSearch(query);
      const prompt    = `请用“【已联网】”开头，总结以下搜索结果：\n${searchTxt}`;
      aiReply         = await runChatWithTools([{ role: 'user', content: prompt }]);
    } else {
      // ③ 普通对话
      aiReply = await runChatWithTools([{ role: 'user', content: message }]);
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