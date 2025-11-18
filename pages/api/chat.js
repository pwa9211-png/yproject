import clientPromise from '../../lib/mongodb'; // 导入优化的连接管理
import { GoogleGenerativeAI } from "@google/genai";

// 初始化 Google AI 客户端
// 确保您的 Vercel 环境变量中设置了 GEMINI_API_KEY
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = "gemini-2.5-flash"; // 使用快速的 Flash 模型

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

    // 检查必需字段
    if (!room || !sender || !message || !aiRole) {
        return res.status(400).json({ 
            message: 'Missing required fields: room, sender, message, or aiRole.',
            error: 'Missing required fields: room, sender, message, or aiRole.' 
        });
    }

    let client;
    try {
        client = await clientPromise;
        const db = client.db('chatDB');
        const messagesCollection = db.collection('messages');

        // 1. 保存用户消息到数据库
        const userMessageDoc = {
            room,
            sender,
            message,
            role: 'user',
            timestamp: new Date(),
        };
        await messagesCollection.insertOne(userMessageDoc);

        // 2. 检查是否需要 AI 回复 (AI 只在被 @ 时回复)
        // 匹配 @AI角色名 或 @aiRole 或 @环球智囊
        const aiMentionRegex = new RegExp(`@${aiRole}|@airole|@环球智囊`, 'i');
        const isAiMentioned = message.match(aiMentionRegex);

        // 如果 AI 没有被 @，则只存储消息，不调用 AI API
        if (!isAiMentioned) {
            return res.status(200).json({ success: true, ai_reply: 'AI 未被 @，不回复。', stored: true });
        }

        // 3. 获取历史消息 (最多 10 条)
        const historyMessages = await messagesCollection
            .find({ room: room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        // 4. 构建 AI API 所需的消息格式 (包括系统提示)
        const systemPrompt = `
            你是一个专业的旅行规划AI，你的名字是“${aiRole}”。
            你的任务是根据用户的需求，为他们提供旅行建议、行程规划或回答相关问题。
            
            **你的回复必须遵循以下格式规范：**
            1.  使用 **Markdown** 格式进行回复。
            2.  使用 **标题 (#)** 来组织不同的主题或日期（例如：'## 推荐行程' 或 '### 第1天'）。
            3.  使用 **粗体 (\*\*\*)** 来强调地点、关键时间或重要信息。
            4.  使用 **列表 (\*)** 来清晰地列出选项、景点或步骤。
            5.  保持回复内容简洁、专业、优雅。
        `;

        const messagesForApi = [
            { role: "system", parts: [{ text: systemPrompt }] },
            ...historyMessages.reverse().map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model', // Gemini API 使用 'user' 和 'model'
                parts: [{ text: msg.message }]
            }))
        ];

        // 5. 调用 Google Gemini API
        const response = await ai.models.generateContent({
            model: model,
            contents: messagesForApi,
        });

        const aiReply = response.text.trim();

        // 6. 保存 AI 回复到数据库
        const aiMessageDoc = {
            room,
            sender: aiRole,
            message: aiReply,
            role: 'model',
            timestamp: new Date(),
        };
        await messagesCollection.insertOne(aiMessageDoc);

        res.status(200).json({ 
            success: true, 
            ai_reply: aiReply, 
            stored: true 
        });

    } catch (error) {
        console.error('Chat API Error:', error);

        // 检查是否是 API 配额或密钥问题
        if (error.status === 429) { 
             return res.status(500).json({ 
                message: '发送失败，请稍后重试。原因: API配额不足或请求频率过高。', 
                error: 'RateLimitError'
            });
        }
        
        res.status(500).json({ 
            message: '发送失败，请稍后重试。原因: 服务器处理错误或数据库连接失败。', 
            error: error.message 
        });
    }
}