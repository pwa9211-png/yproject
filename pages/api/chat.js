// pages/api/chat.js (调整：支持工具调用的两次交互)

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; 

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // 默认 AI 昵称
// -------------------

// 辅助函数：将工具调用对象格式化为可读字符串
function formatToolCall(toolCall) {
    if (toolCall.type === 'web_search') {
        return `⚠️ AI 触发联网搜索：【${toolCall.function?.name || 'web_search'}】关键词：'${toolCall.function?.arguments?.query || '未知'}'。`;
    }
    return JSON.stringify(toolCall);
}

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

    // --- 权限控制逻辑 START ---
    if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
        return res.status(403).json({ success: false, message: `房间 ${RESTRICTED_ROOM} 是限制房间。您无权发送消息。`, ai_reply: '对不起，您无权在此房间发言。' });
    }
    // --- 权限控制逻辑 END ---

    let ChatMessage;
    try {
        const { ChatMessage: CM } = await connectToMongo();
        ChatMessage = CM;
    } catch (dbError) {
        console.error('Database connection failed:', dbError);
        return res.status(500).json({ success: false, message: '数据库连接失败，请检查配置。' });
    }

    const cleanMessage = message.trim();
    if (!cleanMessage) {
        return res.status(200).json({ success: true, message: 'Empty message received.' });
    }

    const isAiMentioned = cleanMessage.includes(`@${AI_SENDER_NAME}`) || cleanMessage.startsWith('/设定角色');

    // 保存用户消息到数据库
    const userMessageDoc = { 
        room,
        sender, 
        message: cleanMessage, 
        role: 'user', 
        timestamp: new Date() 
    };
    await ChatMessage.insertOne(userMessageDoc);

    if (!isAiMentioned && !cleanMessage.startsWith('/设定角色')) {
        return res.status(200).json({ success: true, message: 'User message saved, AI not called.' });
    }

    // 获取上下文历史
    const historyDocs = await ChatMessage.find({ room })
        .sort({ timestamp: 1 }) 
        .limit(20) 
        .toArray();

    const context = historyDocs.map(doc => ({
        role: doc.role, 
        text: doc.message,
    }));

    let aiReply;
    let completion;

    try {
        // 调用 AI API
        completion = await GoogleGenAI(context, aiRole);

        // 检查是否是工具调用
        if (completion?.choices?.[0]?.message?.tool_calls) {
            // 是工具调用，将调用指令格式化为文本回复
            const toolCalls = completion.choices[0].message.tool_calls;
            const functionCall = toolCalls[0].function;

            // 假设我们能够解析出查询关键词
            let query = '未知查询';
            try {
                const args = JSON.parse(functionCall.arguments);
                query = args.query;
            } catch (e) {
                // 如果解析失败，可能是 GLM-4 自己的 web_search 机制
            }

            aiReply = `🌐 **AI 正在联网搜索...**\n\n**搜索关键词：** \`${query}\`\n\n请稍后再问我一次相同的问题，我将尝试直接给出基于通用知识的答案。`;

            // 保存 AI 回复到数据库
            const aiMessageDoc = { 
                room,
                sender: AI_SENDER_NAME, 
                message: aiReply, 
                role: 'model', 
                timestamp: new Date() 
            };
            await ChatMessage.insertOne(aiMessageDoc);

            return res.status(200).json({ 
                success: true, 
                message: 'AI returned tool call, posted status message.', 
                ai_reply: aiReply 
            });
        } else if (completion?.choices?.[0]?.message?.content) {
            // 正常文本回复
            aiReply = completion.choices[0].message.content;

            // 保存 AI 回复到数据库
            const aiMessageDoc = { 
                room,
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
        } else {
            // 无法解析的回复
            aiReply = `⚠️ 收到AI的非标准回复：${JSON.stringify(completion)}`;
        }
    } catch (error) {
        console.error('Chat API Error:', error);

        // 异常处理：保存 AI 调用失败信息到数据库
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