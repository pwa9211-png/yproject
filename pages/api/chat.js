// pages/api/chat.js

// 🚨 修正导入: 使用 '../../lib/mongodb' (注意文件名是 mongodb)
import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

    if (!room || !sender || !message || !aiRole) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: room, sender, message, or aiRole.' 
        });
    }

    try {
        const { ChatMessage, OnlineUser } = await connectToMongo();
        const timestamp = new Date();

        // 1. 保存用户消息
        await ChatMessage.insertOne({ 
            room, 
            sender, 
            message, 
            role: 'user', 
            timestamp 
        });

        // 2. 更新用户心跳
        await OnlineUser.updateOne(
            { room, sender },
            { $set: { last_seen: timestamp, sender } },
            { upsert: true }
        );

        // 3. 检查 AI 回复
        const aiName = aiRole.replace(/\*\*/g, '');
        const aiMentionPattern = new RegExp(`@${aiName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'); 
        const isMentioned = aiMentionPattern.test(message);

        if (!isMentioned) {
            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。' 
            });
        }
        
        // 4. 获取上下文
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        const context = historyDocs.reverse().map(doc => ({
            role: doc.role === 'user' ? 'user' : 'model', 
            text: doc.message
        }));

        const cleanMessage = message.replace(aiMentionPattern, '').trim();
        context.push({ role: 'user', text: cleanMessage });

        // 5. 调用 AI
        const aiReply = await GoogleGenAI(context, aiRole);
        
        // 6. 保存 AI 回复
        await ChatMessage.insertOne({ 
            room, 
            sender: aiRole, 
            message: aiReply, 
            role: 'model', 
            timestamp: new Date() 
        });

        return res.status(200).json({ 
            success: true, 
            message: 'Message and AI reply saved.', 
            ai_reply: aiReply 
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error.', 
            error: error.message 
        });
    }
}