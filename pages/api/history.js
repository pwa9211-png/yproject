// /pages/api/history.js

import { MongoClient } from 'mongodb';

// 从环境变量中读取配置
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'chat_database';
const COLLECTION_NAME = 'room_messages';

let cachedDb = null;

// MongoDB 连接函数 (与 chat.js 中相同)
async function connectToDatabase() {
    if (cachedDb) return cachedDb;

    const client = await MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(DB_NAME);
    cachedDb = db;
    return db;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: '只允许 GET 请求' });
    }

    const { room_id } = req.query;

    if (!room_id) {
        return res.status(400).json({ message: '缺少 room_id 参数' });
    }

    try {
        const db = await connectToDatabase();
        const messagesCollection = db.collection(COLLECTION_NAME);
        
        // 查询该房间的所有消息，按时间戳排序
        const messages = await messagesCollection.find({ roomId: room_id })
                                                 .sort({ timestamp: 1 })
                                                 .project({ _id: 0, sender: 1, content: 1, type: 1 }) // 只返回需要的字段
                                                 .toArray();

        // 返回消息列表
        res.status(200).json({ messages: messages });

    } catch (error) {
        console.error('获取历史消息错误:', error);
        res.status(500).json({ 
            message: '服务器处理错误', 
            error: error.message 
        });
    }
}