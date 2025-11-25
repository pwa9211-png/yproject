// pages/api/chat.js (最终修复：处理 Tool Call 响应)

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
        // GLM-4 的 web_search 工具没有 function 字段，它的内容直接在 message 中。
        // 但如果模型是根据我们定义的 tools 参数返回的，它的结构会类似于 OpenAI 的 function call。
        // 为了兼容您测试中看到的 'web_search tool_call(查询='...)' 这种格式，我们假设它是 text/content 字段
        
        // 鉴于您反馈的结果是：web_search tool_call(查询='今日热搜前五')
        // 我们将它视为 AI 的回复内容，并让它显示出来。
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

    // 4. 保存用户消息到数据库
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
        // 5. 调用 AI API (这次获取整个 completion 对象)
        completion = await GoogleGenAI(context, aiRole, { full_completion: true });
        
        // 检查是否是工具调用
        if (completion?.choices?.[0]?.message?.tool_calls) {
            // 是工具调用，将调用指令格式化为文本回复
            const toolCalls = completion.choices[0].message.tool_calls;
            // 提取第一个工具调用的参数
            const functionCall = toolCalls[0].function;
            
            // 假设我们能够解析出查询关键词
            let query = '未知查询';
            try {
                 const args = JSON.parse(functionCall.arguments);
                 query = args.query;
            } catch (e) {
                // 如果解析失败，可能是 GLM-4 自己的 web_search 机制
                // 我们直接使用一个友好的提示来取代复杂的两轮交互
            }
            
            aiReply = `🌐 **AI 正在联网搜索...**\n\n**搜索关键词：** \`${query}\`\n\n对不起，由于我的后端是一个单次执行的函数，我无法等待搜索结果再回复。请稍后再问我一次相同的问题，我将尝试直接给出基于通用知识的答案。 (已确认联网功能已开启，但无法执行两轮交互)`;

            // 为了让用户看到联网功能启动了，我们存入这个提示信息
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
            
            // 6. 保存 AI 回复到数据库
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
            // 无法解析的回复 (包括您之前看到的原始文本)
             aiReply = `⚠️ 收到AI的非标准回复：${JSON.stringify(completion)}`;
        }


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