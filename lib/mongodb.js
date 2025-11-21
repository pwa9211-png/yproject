// pages/api/chat.js

// 🚨 修正路径：从 /pages/api 向上跳两级到项目根目录，然后进入 /lib/mongodb
import { connectToMongo } from '../../lib/mongodb'; 
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

    // --- 🚨 权限控制逻辑 START ---
    const RESTRICTED_ROOM = '2';
    const ALLOWED_USERS = ['Didy', 'Shane']; 

    if (room === RESTRICTED_ROOM) {
        if (!ALLOWED_USERS.includes(sender)) {
            // 如果用户不在白名单内，拒绝操作
            return res.status(403).json({
                success: false,
                message: `房间 ${RESTRICTED_ROOM} 是限制房间。您的身份不被允许发送消息。`,
            });
        }
    }
    // --- 权限控制逻辑 END ---

    try {
        const { ChatMessage, OnlineUser } = await connectToMongo();

        const timestamp = new Date();

        // 1. 保存用户消息到数据库
        const userMessageDoc = { 
            room,
            sender, 
            message, 
            role: 'user', 
            timestamp 
        };
        await ChatMessage.insertOne(userMessageDoc);

        // 2. 更新用户心跳
        await OnlineUser.updateOne(
            { room: room, sender: sender }, 
            { $set: { last_seen: new Date() } }, 
            { upsert: true }
        );

        // 3. 检查是否需要 AI 回复 
        const aiMentionPattern = new RegExp(`@${aiRole.replace(/\*\*/g, '')}`, 'i');
        const setRoleCommandPattern = new RegExp('/设定角色\\s*(.+)', 'i');
        const roleMatch = message.match(setRoleCommandPattern);

        if (roleMatch) {
            return res.status(200).json({ 
                success: true, 
                message: 'Command processed.', 
                ai_reply: 'AI 角色设定成功。'
            });
        }

        if (!message.match(aiMentionPattern)) {
            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。'
            });
        }
        
        // 4. 获取最近的聊天历史作为上下文
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        const context = historyDocs.reverse().map(doc => ({
            role: doc.role === 'user' ? 'user' : 'model', 
            text: doc.message
        })).filter(m => m.text);

        const cleanMessage = message.replace(aiMentionPattern, '').trim();
        context.push({ role: 'user', text: cleanMessage });

        // 5. 调用 AI API
        const aiReply = await GoogleGenAI(context, aiRole);
        
        // 6. 保存 AI 回复到数据库
        const aiMessageDoc = { 
            room,
            sender: aiRole.replace(/\*\*/g, ''),
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
            message: 'Internal Server Error during processing or database operation.', 
            details: error.message
        });
    }
}