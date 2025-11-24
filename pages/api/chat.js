// pages/api/chat.js

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; // 确保正确导入 AI 客户端

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 

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
    if (room === RESTRICTED_ROOM) {
        if (!ALLOWED_USERS.includes(sender)) {
            // 如果用户不在白名单内，拒绝操作
            return res.status(403).json({
                success: false,
                message: `房间 ${RESTRICTED_ROOM} 是限制房间。您的身份不被允许发送消息。`,
            });
        }
    }
    // --- 权限控制逻辑 END ---\r\n

    try {
        const { ChatMessage, OnlineUser } = await connectToMongo();

        // 2. 处理 /设定角色 命令
        if (message.startsWith('/设定角色')) {
            const newRole = message.substring('/设定角色'.length).trim();
            // 角色设定成功后，前端应更新 aiRole 状态，后端无需回复 AI 消息
            return res.status(200).json({ 
                success: true, 
                message: 'User command processed.', 
                ai_reply: '角色设定成功' 
            });
        }

        // 3. 检查是否需要 AI 回复 (通过 @ 检查)
        const aiMentionPattern = new RegExp(`@${aiRole.replace(/[-/\\^$*+?.()|[]{}]/g, '\\$&')}`);
        const shouldAiReply = message.includes(`@${aiRole.replace(/\*\*/g, '')}`) || message.includes(`@${aiRole}`);

        if (!shouldAiReply) {
            // 仅保存用户消息，不调用 AI
            await ChatMessage.insertOne({ 
                room, 
                sender, 
                message, 
                role: 'user', 
                timestamp: new Date() 
            });

            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。'
            });
        }
        
        // 4. 获取最近的聊天历史作为上下文
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 })
            .limit(15) // 🚨 Kimi 建议的 15 条上下文
            .toArray();

        // 格式化历史记录为 AI 格式（使用 {role, text} 结构）
        let context = historyDocs.reverse().map(doc => ({
            role: doc.role === 'user' ? 'user' : 'model', 
            text: doc.message
        })).filter(m => m.text);

        const cleanMessage = message.replace(aiMentionPattern, '').trim();

        // 🚨 3. AI 调用系统时间逻辑 START (注入时间)
        const timeKeywords = ['时间', '几点', '日期', '星期', '周几', '现在是'];
        const shouldInjectTime = timeKeywords.some(keyword => cleanMessage.includes(keyword));

        if (shouldInjectTime) {
            const currentTime = new Date().toLocaleString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric',
                weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });
            
            // 注入一条特殊的 "系统" 消息到上下文，lib/ai.js 会将其转换为 system role
            const timeMessage = {
                role: 'system_tool', 
                text: `系统工具输出：当前服务器的准确时间是 ${currentTime}。请务必在回复中引用这个时间来回答用户关于时间/日期的问题。`
            };
            
            context.push(timeMessage); 
        } 
        
        // 附加当前用户消息
        context.push({ role: 'user', text: cleanMessage });

        // 🚨 4. 调用 AI API & 开启联网搜索
        const aiReply = await GoogleGenAI(
            context, 
            aiRole, 
            { tools: [{ type: "web_search" }] } // 🚨 启用 web_search 工具
        );
        
        // 5. 保存用户消息到数据库
        await ChatMessage.insertOne({ 
            room, 
            sender, 
            message, 
            role: 'user', 
            timestamp: new Date() 
        });
        
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

        // 如果用户消息已保存，则只返回 AI 错误
        const errorMessage = `AI 回复失败，请重试。详情: ${error.message}`;

        return res.status(500).json({ 
            success: false, 
            message: errorMessage, 
            ai_reply: errorMessage // 返回错误信息以便前端展示
        });
    }
}