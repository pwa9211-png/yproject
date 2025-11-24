// pages/api/chat.js

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; 

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

    // 1. 字段验证
    if (!room || !sender || !message || !aiRole) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: room, sender, message, or aiRole.' 
        });
    }

    // --- 权限控制逻辑 ---
    if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
        return res.status(403).json({
            success: false,
            message: `房间 ${RESTRICTED_ROOM} 是限制房间。您的身份不被允许发送消息。`,
        });
    }
    // --- 权限控制逻辑 END ---

    try {
        const { ChatMessage, OnlineUser } = await connectToMongo();

        const timestamp = new Date();

        // --- 1. 保存用户消息到数据库 ---
        const userMessageDoc = { 
            room,
            sender, 
            message, 
            role: 'user', 
            timestamp 
        };
        await ChatMessage.insertOne(userMessageDoc);

        // --- 2. 更新用户心跳 (确保用户在线) ---
        await OnlineUser.updateOne(
            { room: room, sender: sender }, 
            { $set: { last_seen: new Date() } }, 
            { upsert: true }
        );

        // --- 3. 检查是否需要 AI 回复 (提及 AI 或 /设定角色 命令) ---
        // AI 提及模式: @AI_SENDER_NAME 或 /设定角色
        const aiMentionPattern = new RegExp(`@${AI_SENDER_NAME.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")}\\b`, 'i');

        const isAIMentioned = aiMentionPattern.test(message) || message.startsWith('/设定角色');

        if (!isAIMentioned) {
            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。' 
            });
        }
        
        // --- 4. 获取最近的聊天历史作为上下文 ---
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 })
            .limit(10) // 限制最近 10 条消息作为上下文
            .toArray();

        // 格式化历史记录为 AI 格式 (从旧到新)
        const context = historyDocs.reverse().map(doc => ({
            role: doc.role === 'user' ? 'user' : 'model', 
            text: doc.message
        })).filter(m => m.text);

        // 添加当前用户消息到上下文，并清理 @mention
        const cleanMessage = message.replace(aiMentionPattern, '').trim();
        context.push({ role: 'user', text: cleanMessage });

        // --- 5. 调用 AI API ---
        const aiReply = await GoogleGenAI(context, aiRole);
        
        // --- 6. 保存 AI 回复到数据库 ---
        const aiMessageDoc = { 
            room,
            sender: aiRole, // 使用当前的角色名作为发送者
            message: aiReply, 
            role: 'model', 
            timestamp: new Date() 
        };
        await ChatMessage.insertOne(aiMessageDoc);

        return res.status(200).json({ 
            success: true, 
            message: 'Message and AI reply saved.', 
            ai_reply: aiReply 
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', details: error.message });
    }
}