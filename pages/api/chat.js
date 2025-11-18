// pages/api/chat.js
import clientPromise from '../../lib/mongodb'; 
import OpenAI from 'openai'; // 使用兼容 Kimi Chat API 的 OpenAI 客户端

// --- Kimi Chat 配置 ---
// 注意：Vercel 环境中已设置 MOONSHOT_API_KEY 和 MOONSHOT_BASE_URL
const openai = new OpenAI({
    // 自动读取 Vercel 环境变量中的 MOONSHOT_API_KEY
    apiKey: process.env.MOONSHOT_API_KEY, 
    // 自动读取 Vercel 环境变量中的 MOONSHOT_BASE_URL
    baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1", 
});

const kimiModel = "moonshot-v1-8k"; // Kimi Chat 的一个标准模型

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

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
        const aiMentionRegex = new RegExp(`@${aiRole}|@airole|@环球智囊`, 'i');
        const isAiMentioned = message.match(aiMentionRegex);

        if (!isAiMentioned) {
            return res.status(200).json({ success: true, ai_reply: 'AI 未被 @，不回复。', stored: true });
        }

        // 3. 获取历史消息 (最多 10 条)
        const historyMessages = await messagesCollection
            .find({ room: room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        // 4. 构建 API 所需的消息格式 (包括系统提示)
        const systemPrompt = `
            你是一个专业的旅行规划AI，你的名字是“${aiRole}”。
            你的任务是根据用户的需求，为他们提供旅行建议、行程规划或回答相关问题。
            
            你的回复**必须**遵循以下格式规范：
            1.  使用 **Markdown** 格式进行回复，与前端渲染保持一致。
            2.  使用 **标题 (#)** 来组织不同的主题或日期。
            3.  使用 **粗体 (\*\*\*)** 来强调地点、关键时间或重要信息。
            4.  使用 **列表 (\*)** 来清晰地列出选项、景点或步骤。
        `;

        const messagesForApi = [
            { role: "system", content: systemPrompt },
            ...historyMessages.reverse().map(msg => ({
                // Kimi API 使用 'user' 和 'assistant'
                role: msg.role === 'user' ? 'user' : 'assistant', 
                content: msg.message
            }))
        ];

        // 5. 调用 Kimi Chat API
        const response = await openai.chat.completions.create({
            model: kimiModel,
            messages: messagesForApi,
            temperature: 0.5,
        });

        // 检查 API 是否返回了内容
        const aiReply = response.choices[0]?.message?.content?.trim();

        if (!aiReply) {
             throw new Error("Kimi API 返回空回复，请检查配额或模型状态。");
        }

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
        
        let errorMessage = '服务器处理错误或数据库连接失败。';
        if (error.status === 401) {
             errorMessage = 'API 密钥错误（MOONSHOT_API_KEY）或认证失败。';
        } else if (error.status === 429) { 
             // 示例图 B5a718 显示过 RateLimitError，此处增强提示
             errorMessage = 'API 配额不足或请求频率过高。请检查 Kimi Chat 后台。'; 
        } else if (error.message.includes("ENOENT") || error.message.includes("EAI_AGAIN")) {
             // 检查网络连接错误，这可能就是“需要翻墙”时 Gemini 抛出的错误
             errorMessage = '网络连接失败或目标 API 不可达。';
        }

        res.status(500).json({ 
            message: `发送失败，请稍后重试。原因: ${errorMessage}`, 
            error: error.message 
        });
    }
}