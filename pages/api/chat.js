// pages/api/chat.js

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; // 确保正确导入 AI 客户端

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // 必须与前端保持一致

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

    // --- 权限控制逻辑 START ---
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

        // 0. 检查是否是 /设定角色 命令 (如果命令被前端处理了，后端也需要处理)
        const roleCommandMatch = message.match(/^\/设定角色\s+(.+)/);
        if (roleCommandMatch) {
            // 如果是 /设定角色 命令，只保存用户消息，AI 回复已在前端处理，此处不进行 AI 调用
            // 确保用户消息已保存
            const userMessageDoc = { 
                room,
                sender, 
                message, 
                role: 'user', 
                timestamp 
            };
            await ChatMessage.insertOne(userMessageDoc);
            
            // 记录 AI 角色设定成功的消息
            const aiRoleMessage = {
                room,
                sender: AI_SENDER_NAME,
                message: `角色设定命令已接收。新的 AI 身份是：**${roleCommandMatch[1].trim()}**。`,
                role: 'model',
                timestamp: new Date()
            };
            await ChatMessage.insertOne(aiRoleMessage);

            return res.status(200).json({ 
                success: true, 
                message: 'User message and role change recorded.', 
                ai_reply: aiRoleMessage.message // 返回 AI 的确认消息，让前端显示
            });
        }

        // --- 1. 保存用户消息到数据库 ---
        const userMessageDoc = { 
            room, 
            sender, 
            message, 
            role: 'user', 
            timestamp 
        };
        await ChatMessage.insertOne(userMessageDoc);

        // --- 2. 更新用户心跳 ---
        await OnlineUser.updateOne(
            { room, sender },
            { $set: { last_seen: new Date() } },
            { upsert: true }
        );

        // --- 3. 检查是否提及 AI ---
        // 修正正则，确保匹配 @万能助理 或 @万能助理 (AI 的角色名可能包含空格)
        const aiMentionPattern = new RegExp(`@${AI_SENDER_NAME.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1')}`, 'i');
        const shouldReply = aiMentionPattern.test(message);

        if (!shouldReply) {
            // 如果 AI 未被提及，仅保存用户消息后返回
            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。' 
            });
        }
        
        // --- 4. 获取最近的聊天历史作为上下文 ---
        // 获取房间的最近 10 条消息作为上下文
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        // 格式化历史记录为 AI 格式 (Kimi/Moonshot/OpenAI 兼容)
        const context = historyDocs.reverse().map(doc => ({
            role: doc.role === 'model' ? 'model' : 'user', // 这里使用 'model' 保持与 chat.js 的约定，ai.js 中会转为 'assistant'
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
            // 确保 AI 的昵称是常量，而不是 aiRole
            sender: AI_SENDER_NAME, 
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
        console.error('Chat API Fatal Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error during chat processing.',
            details: error.message
        });
    }
}