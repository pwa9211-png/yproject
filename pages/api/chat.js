// pages/api/chat.js
import { connectToMongo } from '../../lib/mongodb';
import { runChatWithTools } from '../../lib/ai';

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane'];
const AI_SENDER_NAME = '万能助理';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, sender, message } = req.body;

  if (!room || !sender || !message) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // 权限控制
  if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
    return res.status(403).json({ success: false, message: `房间 ${RESTRICTED_ROOM} 是限制房间。` });
  }

  try {
    const { ChatMessage } = await connectToMongo();

    // 保存用户消息
    await ChatMessage.insertOne({ room, sender, message, role: 'user', timestamp: new Date() });

    // 暴力测试：直接搜
    if (message.includes(`@${AI_SENDER_NAME}`)) {
      const toolRes = await runChatWithTools([{ role: 'user', content: message }]);
      await ChatMessage.insertOne({
        room,
        sender: AI_SENDER_NAME,
        message: `【已联网】\n${toolRes}`,
        role: 'model',
        timestamp: new Date()
      });
      return res.status(200).json({ success: true, message: 'Force search done.' });
    }

    // 调用 AI
    const aiReply = await runChatWithTools([{ role: 'user', content: message }]);
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