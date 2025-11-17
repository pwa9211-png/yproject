// /pages/api/chat.js (Next.js Pages Router 结构)

import { OpenAI } from 'openai';
import { MongoClient } from 'mongodb';

// 从环境变量中读取配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'chat_database';
const COLLECTION_NAME = 'room_messages';

// 假设 OpenAI 客户端和 MongoDB 连接
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
let cachedDb = null;

// MongoDB 连接函数
async function connectToDatabase() {
    if (cachedDb) return cachedDb;

    const client = await MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(DB_NAME);
    cachedDb = db;
    return db;
}

// 写入消息到 MongoDB 的辅助函数
async function insertMessage(db, roomId, sender, content, type) {
    const messagesCollection = db.collection(COLLECTION_NAME);
    await messagesCollection.insertOne({
        roomId: roomId,
        sender: sender,
        content: content,
        type: type, // 'user', 'ai'
        timestamp: new Date()
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: '只允许 POST 请求' });
    }

    const { room_id, nickname, message, history, system_prompt } = req.body;

    if (!room_id || !nickname || !message || !system_prompt) {
        return res.status(400).json({ message: '缺少必要的参数' });
    }
    
    try {
        const db = await connectToDatabase();
        
        // 1. **将当前用户消息写入数据库** (A 发言)
        await insertMessage(db, room_id, nickname, message, 'user');

        // 2. **构造发送给 OpenAI 的消息列表**
        // 确保历史记录中包含系统指令
        const messages = [
            { role: 'system', content: system_prompt },
            ...history.map(msg => ({ role: msg.role, content: msg.content })) // 使用前端传来的历史
        ];
        
        // 3. **调用 OpenAI API 获取回复**
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // 使用一个经济高效的模型
            messages: messages,
        });

        const aiResponse = completion.choices[0].message.content;

        // 4. **将 AI 的回复写入数据库**
        await insertMessage(db, room_id, '环球智囊', aiResponse, 'ai');
        
        // 5. **返回 AI 回复给发送者 (用户 A)**
        res.status(200).json({ ai_response: aiResponse, message: '消息已发送并存储' });

    } catch (error) {
        console.error('API 处理错误:', error);
        res.status(500).json({ 
            message: '服务器处理错误', 
            error: error.message 
        });
    }
}