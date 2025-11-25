// pages/api/chat.js (移除部署验证标记)

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; 

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // 默认 AI 昵称
// -------------------

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    // 从请求体中获取数据
    const { room, sender, message, aiRole } = req.body;

    // 1. 字段验证
    if (!room || !sender || !message || !aiRole) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: room, sender, message, or aiRole.' 
        });
    }

    // --- 🚨 权限控制逻辑 START ---
    if (room === RESTRICTED_ROOM) {
        if (!ALLOWED_USERS.includes(sender)) {
            // 如果用户不在白名单内，拒绝操作
            return res.status(403).json({
                success: false,
                message: `房间 ${RESTRICTED_ROOM} 是限制房间。您无权发送消息。`,
                // 返回一个特殊的回复，以免前端报错
                ai_reply: '对不起，您无权在此房间发言。' 
            });
        }
    }
    // --- 权限控制逻辑 END ---

    // 2. 连接数据库
    let ChatMessage;
    try {
        const { ChatMessage: CM } = await connectToMongo();
        ChatMessage = CM;
    } catch (dbError) {
        console.error('Database connection failed:', dbError);
        return res.status(500).json({ success: false, message: '数据库连接失败，请检查配置。' });
    }

    // 3. 准备消息和上下文
    const cleanMessage = message.trim();
    if (!cleanMessage) {
        return res.status(200).json({ success: true, message: 'Empty message received.' });
    }

    // 检查是否需要 AI 回复 (包含 @万能助理 或 /设定角色 命令)
    const isAiMentioned = cleanMessage.includes(`@${AI_SENDER_NAME}`) || cleanMessage.startsWith('/设定角色');

    // 4. 保存用户消息到数据库
    const userMessageDoc = { 
        room,
        sender, 
        message: cleanMessage, 
        role: 'user', 
        timestamp: new Date() 
    };
    await ChatMessage.insertOne(userMessageDoc);


    // 如果没有提及 AI 且不是 /设定角色 命令，则不需要 AI 回复
    if (!isAiMentioned && !cleanMessage.startsWith('/设定角色')) {
        return res.status(200).json({ success: true, message: 'User message saved, AI not called.' });
    }

    // 如果需要 AI 回复，获取上下文历史
    const historyDocs = await ChatMessage.find({ room })
        .sort({ timestamp: 1 }) 
        .limit(20) // 只取最近的 20 条消息作为上下文
        .toArray();

    // 格式化上下文给 AI
    const context = historyDocs.map(doc => ({
        role: doc.role, // 'user' 或 'model'
        text: doc.message,
    }));

    let aiReply;

    try {
        // 5. 调用 AI API
        aiReply = await GoogleGenAI(context, aiRole);
        
        // **********************************************
        // 🚨 部署验证标记已移除
        // **********************************************
        
        // 6. 保存 AI 回复到数据库
        const finalAiSender = AI_SENDER_NAME; 

        const aiMessageDoc = { 
            room,
            sender: finalAiSender, 
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
        
        // 7. 异常处理：保存 AI 调用失败信息到数据库
        const errorReply = `对不起，AI 服务调用失败。请稍后再试。错误信息：${error.message}`;
        await ChatMessage.insertOne({ 
            room,
            sender: AI_SENDER_NAME, 
            message: errorReply, 
            role: 'model', 
            timestamp: new Date() 
        });

        return res.status(500).json({ 
            success: false, 
            message: 'AI 调用失败，错误已记录。', 
            details: error.message 
        });
    }
}