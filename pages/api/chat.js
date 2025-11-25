// pages/api/chat.js  （无模拟搜索，纯两次交互）

import { connectToMongo } from '../../lib/mongodb';
import { GoogleGenAI } from '../../lib/ai';

/* ----------- 常量 ----------- */
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS   = ['Didy', 'Shane'];
const AI_SENDER_NAME  = '万能助理';

/* ----------- 主接口 ----------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { room, sender, message, aiRole } = req.body;
  if (!room || !sender || !message || !aiRole) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  /* ---- 权限校验 ---- */
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

  /* ---- 是否触发 AI ---- */
  const cleanMsg = message.trim();
  const isAiCall = cleanMsg.includes(`@${AI_SENDER_NAME}`) || cleanMsg.startsWith('/设定角色');
  if (!isAiCall) {
    return res.status(200).json({ success: true, message: '用户消息已保存，AI 未调用' });
  }

  /* ---- 拼装上下文（含上次助手/tool消息）---- */
  const hist = await ChatMessage.find({ room })
    .sort({ timestamp: 1 })
    .limit(30)
    .toArray();
  const context = hist.map((h) => ({ role: h.role, text: h.message }));

  /* ========== 唯一一次 GoogleGenAI 调用 ========== */
  const completion = await GoogleGenAI(context, aiRole);

  /* ---- 解析返回 ---- */
  const choice   = completion?.choices?.[0];
  let   replyTxt = '';

  if (!choice) {
    replyTxt = 'AI 返回空内容';
  } else if (choice.message?.tool_calls?.[0]) {
    /* ---- 第一次：模型要求工具 ---- */
    replyTxt =
      '🌐 已发起联网搜索，请**再次发送相同问题**以获取最终答案（二次交互）。';
  } else {
    /* ---- 第二次：直接拿到最终答案 ---- */
    replyTxt = choice.message.content || 'AI 未返回内容';
  }

  /* ---- 落库 AI 回复 ---- */
  await ChatMessage.insertOne({
    room,
    sender: AI_SENDER_NAME,
    message: replyTxt,
    role: 'model',
    timestamp: new Date(),
  });

  return res.status(200).json({ success: true, ai_reply: replyTxt });
}