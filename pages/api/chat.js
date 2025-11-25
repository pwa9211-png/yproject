	// pages/api/chat.js (最终简化版)
	import { connectToMongo } from '../../lib/mongodb';
	import { runChatWithTools } from '../../lib/ai'; // 导入我们新的、封装了所有逻辑的AI函数
	// --- 权限与配置常量 ---
	const RESTRICTED_ROOM = '2';
	const ALLOWED_USERS = ['Didy', 'Shane'];
	const AI_SENDER_NAME = '万能助理';
	// ------------------------
	export default async function handler(req, res) {
	    // 1. 检查请求方法
	    if (req.method !== 'POST') {
	        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
	    }
	    // 2. 获取并验证请求体
	    const { room, sender, message, aiRole } = req.body;
	    if (!room || !sender || !message || !aiRole) {
	        return res.status(400).json({ success: false, message: 'Missing required fields.' });
	    }
	    // 3. 权限检查
	    if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
	        return res.status(403).json({ success: false, message: `房间 ${RESTRICTED_ROOM} 是限制房间。`, ai_reply: '对不起，您无权在此房间发言。' });
	    }
	    // 4. 连接数据库
	    let ChatMessage;
	    try {
	        const { ChatMessage: CM } = await connectToMongo();
	        ChatMessage = CM;
	    } catch (dbError) {
	        console.error('Database connection failed:', dbError);
	        return res.status(500).json({ success: false, message: '服务器内部错误：数据库连接失败。' });
	    }
	    const cleanMessage = message.trim();
	    if (!cleanMessage) {
	        return res.status(200).json({ success: true, message: 'Empty message received.' });
	    }
	    // 5. 保存用户消息（无论是否调用AI，都先保存）
	    await ChatMessage.insertOne({ room, sender, message: cleanMessage, role: 'user', timestamp: new Date() });
	    // 6. 判断是否需要调用AI
	    const isAiMentioned = cleanMessage.includes(`@${AI_SENDER_NAME}`) || cleanMessage.startsWith('/设定角色');
	    if (!isAiMentioned) {
	        return res.status(200).json({ success: true, message: 'User message saved, AI not called.' });
	    }
	    try {
	        // === 核心逻辑：准备数据并调用AI ===
	        // a. 从数据库获取最近的对话历史
	        const historyDocs = await ChatMessage.find({ room }).sort({ timestamp: 1 }).limit(20).toArray();
	        // b. 构建系统提示，这是引导AI行为的关键
	        const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
	        const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是: ${aiRole}。当前系统时间是: ${currentTime}。
	**【重要提醒】你的内部知识库存在时间截点，无法提供最新的即时资讯。**
	**【核心指令】**
	1.  对于任何涉及即时、最新、或需要验证的事实性信息（例如：新闻、热搜、天气、股价、指数、最新事件或人物），你**必须**且**优先**调用 'web_search' 工具来获取外部数据。
	2.  在工具返回结果后，你必须用清晰、简洁的中文总结工具返回的数据，并直接回答用户的问题。
	3.  【绝对优先级】当工具结果提供具体数据时，你必须且只能使用工具结果中的数据，忽略你已有的知识。
	4.  不要在最终回复中重复用户的提问内容，直接给出答案。
	5.  如果用户使用 /设定角色 命令，你应回复“角色设定成功”。`;
	        // c. 构建完整的消息历史数组（系统提示 + 对话历史）
	        const messages = [
	            { role: "system", content: systemInstruction },
	            ...historyDocs.map(doc => ({
	                role: doc.role === 'model' ? 'assistant' : 'user', // 将数据库中的 'model' 映射为 API 需要的 'assistant'
	                content: doc.message,
	            }))
	        ];
	        // d. 调用 ai.js 中的主函数，它会处理包括工具调用在内的所有复杂逻辑，并返回最终答案
	        const finalAiReply = await runChatWithTools(messages);
	        // 7. 保存AI的最终回复到数据库
	        await ChatMessage.insertOne({
	            room,
	            sender: AI_SENDER_NAME,
	            message: finalAiReply,
	            role: 'model',
	            timestamp: new Date()
	        });
	        // 8. 将最终回复返回给前端
	        return res.status(200).json({
	            success: true,
	            message: 'AI reply generated.',
	            ai_reply: finalAiReply
	        });
	    } catch (error) {
	        // 9. 错误处理
	        console.error('Chat API Error:', error);
	        const errorReply = `对不起，AI 服务呼叫失败。请稍后再试。错误信息：${error.message}`;
	        // 即使出错，也尝试保存一条错误消息到数据库，便于排查
	        await ChatMessage.insertOne({
	            room,
	            sender: AI_SENDER_NAME,
	            message: errorReply,
	            role: 'model',
	            timestamp: new Date()
	        }).catch(dbSaveError => console.error("Failed to save error message to DB:", dbSaveError));
	        return res.status(500).json({
	            success: false,
	            message: 'AI 呼叫失败，错误已记录。',
	            details: error.message
	        });
	    }
	}