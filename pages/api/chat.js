// pages/api/chat.js  【预搜索版 - 2025-11-26】
import { connectToMongo } from '../../lib/mongodb';
import { runChatWithTools, performWebSearch } from '../../lib/ai';

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane'];
const AI_SENDER_NAME  = '万能助理';

/** 判断是否需要预搜索 */
function needsSearch(text) {
  const kw = ['今天', '最新', '热搜', '天气', '股价', '百度', '微博', '头条', '前3条', '前三条'];
  return kw.some(k => text.includes(k));
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

    let aiReply;
    // 暴力触发：@万能助理 或 关键词
    if (message.includes(`@${AI_SENDER_NAME}`) || needsSearch(message)) {
      console.log('【预搜索触发】');
      const query = message.replace(`@${AI_SENDER_NAME}`, '').trim();
      const searchTxt = await performWebSearch(query);          // 一定搜
      const prompt    = `请用“【已联网】”开头，总结以下搜索结果：\n${searchTxt}`;
      aiReply         = await runChatWithTools([{ role: 'user', content: prompt }]);
    } else {
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