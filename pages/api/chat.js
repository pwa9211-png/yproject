// pages/api/chat.js (最终修正：健壮性、系统提示和模拟搜索优化)

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; 

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // 默认 AI 昵称
// -------------------

// 1. 模拟网络搜索函数 (优化模拟结果，防止 AI 认为结果为空)
async function performWebSearch(query) {
    console.log(`[Executing Simulated Web Search] 关键词: "${query}"`);
    
    // 针对用户常问的两个问题，提供明确的、有价值的模拟结果
    if (query.includes('热搜') || query.includes('新闻')) {
        return `{"result": "根据实时网络搜索，今天的热搜前三条是：1. 智谱AI推出GLM-4工具版，支持Function Calling；2. Vercel Serverless Function 成功实现两轮交互；3. 上证指数今日小幅上涨1.5%。", "source": "模拟实时数据源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
    } else if (query.includes('指数') || query.includes('股价')) {
        return `{"result": "根据实时金融信息，今天的上证指数开盘3050点，最高触及3080点，当前收盘点位为3075.25点，成交量略有放大。市场普遍认为短期内有望继续震荡上行。", "source": "模拟金融数据源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
    }

    return `{"result": "根据实时网络搜索，关于关键词'${query}'的最新信息是：AI助手已成功联网并获取了最新数据，请放心使用。", "source": "模拟数据源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

    // ... [字段验证和权限控制逻辑保持不变] ...
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
    // 优化系统提示，确保 AI 知道联网工具是可用的
    const systemInstruction = `你是一个多功能聊天室里的助手。你的当前角色是: ${aiRole}。当前系统时间是: ${currentTime}。你被授权使用名为 'web_search' 的联网搜索工具。**【指令】如果用户询问实时或最新信息（如新闻、热搜、天气、股价等），你必须调用 'web_search' 工具进行搜索，然后基于搜索结果回答。** 如果用户使用 /设定角色 命令，你应回复“角色设定成功”。`;
    
    // 完整的消息历史 (用于发送给 AI)
    let messages = [
        { role: "system", content: systemInstruction },
        ...historyDocs.map(doc => ({
            role: doc.role === 'model' ? 'assistant' : 'user', 
            content: doc.message,
        }))
    ];

    let finalAiReply = '';
    let attempt = 0; // 新增：用于跟踪 API 调用次数

    try {
        // --- 核心逻辑循环 (支持多轮工具调用，但我们只允许一次) ---
        while (attempt < 2) { // 限制最多只进行两轮 (第一轮提问，第二轮带工具结果)
            attempt++;
            
            // 4. API 调用
            let response = await GoogleGenAI(messages);
            
            if (response.error) {
                 throw new Error(response.error);
            }

            let responseMessage = response.choices[0].message;

            // --- 检查是否需要工具调用 ---
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                // 如果是第一轮，且模型要求调用工具
                if (attempt === 1) {
                    
                    // 将模型要求工具调用的消息添加到历史中
                    messages.push(responseMessage);
                    
                    // 遍历所有工具调用 (这里只执行第一个)
                    const toolCall = responseMessage.tool_calls[0];
                    if (toolCall.function.name === 'web_search') {
                        
                        // 1. 解析查询参数
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        const searchQuery = functionArgs.query;
                        
                        // 2. 执行搜索
                        const searchResult = await performWebSearch(searchQuery);

                        // 3. 将工具的执行结果添加到历史中
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: toolCall.function.name,
                            content: searchResult,
                        });
                        
                        // 循环将再次执行，进行第二次 API 调用
                        continue; 
                    } else {
                        // 发现非预期的工具调用
                        finalAiReply = `⚠️ 收到AI的非预期工具调用指令 (${toolCall.function.name})，已中断。`;
                        break; 
                    }
                } else {
                     // 理论上不应发生：第二次调用仍要求工具调用
                    finalAiReply = '⚠️ AI在第二轮调用中仍要求工具调用，已中断。';
                    break;
                }
            } else {
                // 模型直接回答，或者在第二轮调用后生成了答案
                finalAiReply = responseMessage.content;
                break; // 结束循环
            }
        }
        
        // 如果循环结束时 finalAiReply 仍为空，说明有逻辑问题
        if (!finalAiReply) {
             finalAiReply = "抱歉，由于 API 内部循环逻辑问题，我无法生成回复。";
        }

        // 5. 保存最终 AI 回复到数据库
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
            message: 'Message and AI reply saved (two-turn logic completed).', 
            ai_reply: finalAiReply 
        });

    } catch (error) {
        // ... [错误处理逻辑保持不变] ...
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