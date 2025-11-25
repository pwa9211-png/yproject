// pages/api/chat.js  【每次 @万能助理 都强制联网搜索】
import { connectToMongo } from '../../lib/mongodb';
import { GoogleGenAI } from '../../lib/ai';
import { zhipuWebSearch } from '../../lib/zsearch';

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS   = ['Didy', 'Shane'];
const AI_SENDER_NAME  = '万能助理';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { room, sender, message, aiRole } = req.body;
  if (!room || !sender || !message || !aiRole) return res.status(400).json({ success: false, message: '缺少字段' });

  if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
    return res.status(403).json({ success: false, message: '限制房间，无权发言' });
  }

  /* ---- 落库用户消息 ---- */
  const { ChatMessage } = await connectToMongo();
  await ChatMessage.insertOne({
    room,
    sender,
    message: message.trim(),
    role: 'user',
    timestamp: new Date(),
  });

  const cleanMsg  = message.trim();
  const isAiCall  = cleanMsg.includes(`@${AI_SENDER_NAME}`) || cleanMsg.startsWith('/设定角色');
  if (!isAiCall) return res.status(200).json({ success: true, message: '用户消息已保存，AI 未调用' });

  /* ---- 拼装上下文 ---- */
  const hist = await ChatMessage.find({ room }).sort({ timestamp: 1 }).limit(30).toArray();
  const context = hist.map((h) => ({ role: h.role, text: h.message }));

  /* === ① 强制先联网搜 === */
  const query      = cleanMsg.replace(`@${AI_SENDER_NAME}`, '').trim();
  const searchRes  = await zhipuWebSearch(query, 5);

  /* === ② 把搜索结果喂给 GLM-4 === */
  const completion = await GoogleGenAI(context, aiRole, searchRes);
  const reply      = completion?.choices?.[0]?.message?.content || '无内容';

  /* ---- 落库 AI 回复 ---- */
  await ChatMessage.insertOne({
    room,
    sender: AI_SENDER_NAME,
    message: reply,
    role: 'model',
    timestamp: new Date(),
  });

  return res.status(200).json({ success: true, ai_reply: reply });
}