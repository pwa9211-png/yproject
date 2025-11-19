// pages/api/chat.js
import clientPromise from '../../lib/mongodb'; 
import OpenAI from 'openai'; 

// --- Kimi Chat 配置 ---
const openai = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY, 
    baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1", 
});

const kimiModel = "moonshot-v1-8k"; 

// *** 关键修改点 1：默认的中立系统提示 ***
const defaultSystemPrompt = `
    你是一个多功能人工智能助手，你的名字是“万能助理”（或您在前端设定的任何名称）。
    
    **你的身份和规则：**
    1.  你是一个聊天室中的人工智能助理，你的主要职责是回答用户提出的任何问题，提供信息或创意。
    2.  如果你没有被指定特定角色，请保持中立、清晰、礼貌地回答用户的问题。
    
    **角色设定规则（最高优先级）：**
    1.  用户可以通过发送“/设定角色 [新的角色描述]”或类似指令来切换你的身份。
    2.  如果用户指定了新角色，你必须在接下来的回复中严格遵守该设定。
    
    **回复格式要求：**
    1.  你的回复必须遵循 Markdown 格式。
    2.  请使用标题、粗体、列表等 Markdown 元素，让回复清晰易读。
`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body; // aiRole 现在默认为 **万能助理**

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
        const configCollection = db.collection('roomConfig'); 

        // 1. 保存用户消息到数据库
        const userMessageDoc = {
            room,
            sender,
            message,
            role: 'user',
            timestamp: new Date(),
        };
        await messagesCollection.insertOne(userMessageDoc);

        // 2. 检查是否需要 AI 回复
        const aiMentionRegex = new RegExp(`@${aiRole.replace(/\*\*/g, '')}`, 'i'); // 清除 ** 以便正确匹配 @万能助理
        const isAiMentioned = message.match(aiMentionRegex);

        if (!isAiMentioned) {
            return res.status(200).json({ success: true, ai_reply: 'AI 未被 @，不回复。', stored: true });
        }
        
        // --- 3. 动态角色设定和更新逻辑 ---
        let currentSystemPrompt = defaultSystemPrompt.replace(/环球智囊/g, aiRole.replace(/\*\*/g, '')); // 替换默认提示中的旧 AI 名称
        
        const roomConfig = await configCollection.findOne({ room: room });
        if (roomConfig && roomConfig.systemPrompt) {
            currentSystemPrompt = roomConfig.systemPrompt;
        }

        // 检查用户消息中是否包含角色设定的指令
        // 使用 aiRole.replace(/\*\*/g, '') 来匹配，以处理 **万能助理** 这种格式
        const roleSetCommand = message.match(new RegExp(`@${aiRole.replace(/\*\*/g, '')}\\s*/设定角色\\s*(.*)`, 'i'));
        
        if (roleSetCommand && roleSetCommand[1]) {
            const newRoleDescription = roleSetCommand[1].trim();
            const newSystemPrompt = `
                你现在被设定为以下角色：【${newRoleDescription}】。
                请严格遵守此设定，并使用 Markdown 格式回答用户的问题。
                你的名字仍然是“${aiRole.replace(/\*\*/g, '')}”。
            `;

            await configCollection.updateOne(
                { room: room },
                { $set: { systemPrompt: newSystemPrompt } },
                { upsert: true }
            );

            const aiReply = `好的，我已成功将我的角色设定为：【${newRoleDescription}】。现在请向我提问吧！`;
            
            const aiMessageDoc = {
                room,
                sender: aiRole,
                message: aiReply,
                role: 'model',
                timestamp: new Date(),
            };
            await messagesCollection.insertOne(aiMessageDoc);

            return res.status(200).json({ 
                success: true, 
                ai_reply: aiReply, 
                stored: true 
            });
        }
        // --- 动态角色设定结束 ---


        // 4. 获取历史消息 (最多 10 条)
        const historyMessages = await messagesCollection
            .find({ room: room })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();

        // 5. 构建 API 所需的消息格式 
        const messagesForApi = [
            { role: "system", content: currentSystemPrompt }, 
            ...historyMessages.reverse().map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant', 
                content: msg.message
            }))
        ];

        // 6. 调用 Kimi Chat API
        const response = await openai.chat.completions.create({
            model: kimiModel,
            messages: messagesForApi,
            temperature: 0.5,
        });

        const aiReply = response.choices[0]?.message?.content?.trim();

        if (!aiReply) {
             throw new Error("Kimi API 返回空回复，请检查配额或模型状态。");
        }

        // 7. 保存 AI 回复到数据库
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
             errorMessage = 'API 配额不足或请求频率过高。请检查 Kimi Chat 后台。'; 
        } else if (error.message.includes("ENOENT") || error.message.includes("EAI_AGAIN")) {
             errorMessage = '网络连接失败或目标 API 不可达。';
        }

        res.status(500).json({ 
            message: `发送失败，请稍后重试。原因: ${errorMessage}`, 
            error: error.message 
        });
    }
}