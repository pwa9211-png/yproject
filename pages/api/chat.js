// pages/api/chat.js

import { connectToMongo } from '../../lib/mongo';
import { GoogleGenAI } from '../../lib/ai';

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

    try {
        const { ChatMessage, OnlineUser } = await connectToMongo();

        const timestamp = new Date();

        // --- 1. 保存用户消息到数据库 (关键：使用 room 字段) ---
        const userMessageDoc = { 
            room, // 🚨 确保使用了 room 字段
            sender, 
            message, 
            role: 'user', 
            timestamp 
        };
        await ChatMessage.insertOne(userMessageDoc);

        // --- 2. 更新用户心跳 (在 online-status 中应更完善，此处也更新) ---
        await OnlineUser.updateOne(
            { room, sender },
            { $set: { last_seen: timestamp, sender } },
            { upsert: true }
        );

        // --- 3. 检查是否需要 AI 回复 ---
        const aiName = aiRole.replace(/\*\*/g, ''); // 移除 Markdown 粗体

        // 检查消息是否以 @AI_NAME 开头
        const aiMentionPattern = new RegExp(`^@${aiName.toLowerCase()}\\s*`);
        const isMentioned = message.toLowerCase().startsWith(`@${aiName.toLowerCase()}`) || message.toLowerCase().includes(`@${aiName.toLowerCase()}`);

        if (!isMentioned) {
            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。' // 明确返回 AI 未回复信息
            });
        }
        
        // --- 4. 获取最近的聊天历史作为上下文 ---
        // 获取房间的最近 10 条消息作为上下文
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        // 格式化历史记录为 Gemini/OpenAI 格式
        const context = historyDocs.reverse().map(doc => ({
            role: doc.role === 'user' ? 'user' : 'model', 
            text: doc.message
        }));

        // 添加当前用户消息到上下文，并清理 @mention
        const cleanMessage = message.replace(aiMentionPattern, '').trim();
        context.push({ role: 'user', text: cleanMessage });

        // --- 5. 调用 AI API ---
        const aiReply = await GoogleGenAI(context, aiRole);
        
        // --- 6. 保存 AI 回复到数据库 ---
        const aiMessageDoc = { 
            room, // 🚨 确保使用了 room 字段
            sender: aiRole, 
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
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error during chat processing.', 
            error: error.message 
        });
    }
}