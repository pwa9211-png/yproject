// pages/api/chat.js (实现两轮工具调用逻辑)

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; 

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // 默认 AI 昵称
// -------------------

// 1. 模拟网络搜索函数 (请根据需要替换为真实的搜索 API 调用)
async function performWebSearch(query) {
    console.log(`[Executing Simulated Web Search] 关键词: "${query}"`);
    // 这是一个明确的模拟结果，用于测试两轮交互的逻辑。
    // 如果需要真实搜索，请在这里调用第三方搜索 API 并返回结果。
    return `{"result": "根据实时网络搜索，关于关键词'${query}'的最新信息是：智谱AI宣布推出更稳定的多模态模型，Vercel 服务器近期稳定运行，Node.js 生态圈正在大规模转向ESM模块。", "source": "模拟数据源 / 2025年11月25日"}`;
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

    // 1. 字段验证/权限控制
    if (!room || !sender || !message || !aiRole) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
        return res.status(403).json({ success: false, message: `房间 ${RESTRICTED_ROOM} 是限制房间。`, ai_reply: '对不起，您无权在此房间发言。' });
    }

    let ChatMessage;
    try {
        const { ChatMessage: CM } = await connectToMongo();
        ChatMessage = CM;
    } catch (dbError) {
        console.error('Database connection failed:', dbError);
        return res.status(500).json({ success: false, message: '数据库连接失败。' });
    }

    const cleanMessage = message.trim();
    if (!cleanMessage) {
        return res.status(200).json({ success: true, message: 'Empty message received.' });
    }

    const isAiMentioned = cleanMessage.includes(`@${AI_SENDER_NAME}`) || cleanMessage.startsWith('/设定角色');

    // 2. 保存用户消息
    const userMessageDoc = { room, sender, message: cleanMessage, role: 'user', timestamp: new Date() };
    await ChatMessage.insertOne(userMessageDoc);

    if (!isAiMentioned && !cleanMessage.startsWith('/设定角色')) {
        return res.status(200).json({ success: true, message: 'User message saved, AI not called.' });
    }

    // 3. 准备上下文 (用于 AI 的 messages 数组)
    const historyDocs = await ChatMessage.find({ room }).sort({ timestamp: 1 }).limit(20).toArray();

    // 准备系统消息
    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const systemInstruction = `你是一个多功能聊天室里的助手。你的当前角色是: ${aiRole}。当前系统时间是: ${currentTime}。你被授权访问联网搜索工具（web_search）。【重要】如果用户询问即时信息，你必须使用联网工具。如果用户使用 /设定角色 命令，你应回复“角色设定成功”。`;
    
    // 完整的消息历史 (用于发送给 AI)
    let messages = [
        { role: "system", content: systemInstruction },
        ...historyDocs.map(doc => ({
            // 将历史记录中的 role 映射为 Zhipu/OpenAI 兼容的 role
            role: doc.role === 'model' ? 'assistant' : 'user', 
            content: doc.message,
        }))
    ];

    let finalAiReply = '';

    try {
        // --- 第一轮 API 调用 ---
        let firstResponse = await GoogleGenAI(messages);
        
        // 检查是否有 API 错误
        if (firstResponse.error) {
             throw new Error(firstResponse.error);
        }

        let responseMessage = firstResponse.choices[0].message;

        // --- 检查是否需要工具调用 ---
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            
            // 将模型要求工具调用的消息添加到历史中
            messages.push(responseMessage);
            
            // 遍历所有工具调用 (这里只关注第一个)
            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.function.name === 'web_search') {
                    // 1. 解析查询参数
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    const searchQuery = functionArgs.query;
                    
                    // 2. 执行搜索 (调用我们的模拟/真实搜索函数)
                    const searchResult = await performWebSearch(searchQuery);

                    // 3. 将工具的执行结果添加到历史中
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: toolCall.function.name,
                        content: searchResult,
                    });
                }
            }

            // --- 第二轮 API 调用 ---
            // 带着工具执行结果的完整对话历史发送给模型，让它生成最终答案
            const secondResponse = await GoogleGenAI(messages);
            if (secondResponse.error) {
                 throw new Error(secondResponse.error);
            }
            
            finalAiReply = secondResponse.choices[0].message.content;

        } else {
            // 模型直接回答，无需工具调用
            finalAiReply = responseMessage.content;
        }

        // 4. 保存 AI 回复到数据库
        const finalAiSender = AI_SENDER_NAME;

        const aiMessageDoc = { 
            room,
            sender: finalAiSender, 
            message: finalAiReply, 
            role: 'model', 
            timestamp: new Date() 
        };
        await ChatMessage.insertOne(aiMessageDoc);

        return res.status(200).json({ 
            success: true, 
            message: 'Message and AI reply saved (possibly after two-turn tool call).', 
            ai_reply: finalAiReply 
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        
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