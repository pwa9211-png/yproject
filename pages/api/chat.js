// pages/api/chat.js
// 2025-11-28 Gemini 极简版：利用 Google 原生搜索能力
import { connectToMongo } from '../../lib/mongodb';
import { geminiChat } from '../../lib/gemini';

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS   = ['Didy', 'Shane'];
const AI_SENDER_NAME  = '万能助理';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, sender, message, aiRole } = req.body;

  if (!room || !sender || !message) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // 权限检查
  if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
    return res.status(403).json({ success: false, message: `房间 ${RESTRICTED_ROOM} 是限制房间。` });
  }

  try {
    const { ChatMessage } = await connectToMongo();

    // 1. 保存用户发送的消息
    await ChatMessage.insertOne({ room, sender, message, role: 'user', timestamp: new Date() });

    // 2. 如果没 @万能助理，就不理会，直接结束
    if (!message.includes(`@${AI_SENDER_NAME}`)) {
      return res.status(200).json({ success: true, message: 'No AI trigger.' });
    }

    // 3. 准备历史记录 (给 Gemini 看上下文)
    // 读取最近 10 条，让它知道你们之前在聊什么
    const historyDocs = await ChatMessage
      .find({ room })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    // 格式化历史记录 (按时间正序: 旧 -> 新)
    const historyMessages = historyDocs.reverse().map(doc => ({
      role: doc.role === 'model' ? 'model' : 'user', // Gemini 里的 AI 叫 model
      content: doc.message
    }));

    // 4. 清理消息文本
    // 把 "@万能助理" 去掉，否则 AI 会觉得你在复读它的名字
    const cleanMessage = message.replace(`@${AI_SENDER_NAME}`, '').trim();
    
    // 如果有角色设定，拼接到前面提醒它
    const currentRole = aiRole || '万能助理';
    const finalMessage = `(你的身份是：${currentRole}) ${cleanMessage}`;

    console.log(`【Gemini】收到提问: ${cleanMessage}`);

    // 5. 呼叫 Gemini！
    // 它会自动判断要不要上网搜
    const aiReply = await geminiChat(historyMessages, finalMessage);

    // 6. 保存 AI 的回复
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
    return res.status(500).json({ 
        success: false, 
        message: 'AI 呼叫失败，请检查 API Key 是否配置正确。', 
        details: error.message 
    });
  }
}