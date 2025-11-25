// pages/api/chat.js

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; // 确保正确导入 AI 客户端

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
                message: `房间 ${RESTRICTED_ROOM} 是限制房间。您的身份不被允许发送消息。`,
            });
        }
    }
    // --- 权限控制逻辑 END ---\

    // 2. 检查 AI 提及和角色设定命令
    // 匹配当前 aiRole 或默认 AI_SENDER_NAME
    const aiMentionPattern = new RegExp(`@${aiRole.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}|@${AI_SENDER_NAME}`, 'i'); 
    const isAiMentioned = aiMentionPattern.test(message);
    const isRoleCommand = message.trim().startsWith('/设定角色');
    let newAiRole = aiRole;
    let aiReply;

    try {
        const { ChatMessage, OnlineUser } = await connectToMongo();

        // 3. 保存用户消息到数据库
        const userMessageDoc = { 
            room,
            sender,
            message, 
            role: 'user', 
            timestamp: new Date() 
        };
        await ChatMessage.insertOne(userMessageDoc);
        
        // 3.1. 如果 AI 未被提及且不是角色设定命令，则直接返回
        if (!isAiMentioned && !isRoleCommand) {
            return res.status(200).json({ 
                success: true, 
                message: 'User message saved.', 
                ai_reply: 'AI 未被 @，不回复。'
            });
        }
        
        // --- 角色设定逻辑 START ---
        if (isRoleCommand) {
            // 提取新角色
            const match = message.trim().match(/\/设定角色\s+(.+)/i);
            if (match && match[1].trim()) {
                newAiRole = match[1].trim().replace(/\*\*/g, ''); // 移除可能的 Markdown 粗体
                aiReply = `角色设定成功，新的 AI 身份是：${newAiRole}`;
                // 注意：这里只返回给前端新角色，实际 AI 的 context 由 lib/ai.js 中的 system instruction 保持
            } else {
                aiReply = '角色设定失败。请使用正确的格式：/设定角色 [新角色描述]';
            }

            // 6. 保存 AI 回复到数据库 (角色设定回复)
            const aiMessageDoc = { 
                room,
                sender: AI_SENDER_NAME, // 角色设定消息统一使用默认昵称作为发送者
                message: aiReply, 
                role: 'model', 
                timestamp: new Date() 
            };
            await ChatMessage.insertOne(aiMessageDoc);
            
            // 返回结果
            return res.status(200).json({ 
                success: true, 
                message: 'Role command executed.', 
                ai_reply: aiReply 
            });
        }
        // --- 角色设定逻辑 END ---\

        // 4. 获取最近的聊天历史作为上下文
        // 限制在 10 条消息内，以控制成本和 token 长度
        const historyDocs = await ChatMessage.find({ room })
            .sort({ timestamp: -1 }) // 最新消息在前
            .limit(10)
            .toArray();

        // 重新排序并格式化 context
        const context = historyDocs.reverse().map(doc => ({
            // 确保 role 字段是 'user' 或 'model' 以供 lib/ai.js 正确转换
            role: doc.role === 'user' ? 'user' : 'model', 
            text: doc.message
        })).filter(m => m.text);

        // 移除用户消息中的 @提及部分，只将清理后的消息用于 AI 思考
        const cleanMessage = message.replace(aiMentionPattern, '').trim();
        
        // ⭐️ 修复上下文问题：确保用户消息是 context 中的最后一条，并且只包含清理后的文本。
        // 由于我们已经在 3. 中保存了原始消息，这里我们只需要将它添加到 context 数组中供 AI 使用。
        // 注意：historyDocs 已经包含了刚刚保存的 userMessageDoc
        // 故 context 数组的最后一个元素就是刚刚保存的用户消息，我们只需要清理它的内容。
        if (context.length > 0) {
             context[context.length - 1].text = cleanMessage;
        }

        // 5. 调用 AI API
        // 关键：这里传递了当前的角色设定
        aiReply = await GoogleGenAI(context, aiRole);
        
        // 6. 保存 AI 回复到数据库
        // 使用当前 aiRole 作为 sender，以便在前端显示正确的角色名称
        const finalAiSender = aiRole.replace(/\*\*/g, ''); 

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
        
        // 如果出错，尝试返回一个友好的 AI 错误信息
        const friendlyError = error.message.includes('ZHIPU_API_KEY') 
            ? 'AI 服务连接失败，请检查 ZHIPU_API_KEY 配置是否正确。' 
            : `AI 服务调用失败。错误信息: ${error.message}`;

        return res.status(500).json({ 
            success: false, 
            message: friendlyError,
            ai_reply: friendlyError
        });
    }
}