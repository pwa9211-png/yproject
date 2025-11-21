// pages/api/history.js

import { connectToMongo } from '../../lib/mongo';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room } = req.query;

    // 1. 字段验证
    if (!room) {
        return res.status(400).json({ success: false, message: 'Missing required query parameter: room.' });
    }

    try {
        const { ChatMessage } = await connectToMongo();

        // --- 2. 从数据库查询历史记录 (关键：使用 room 字段进行过滤) ---
        const history = await ChatMessage.find({ room }) // 🚨 确保了按 room 过滤
            .sort({ timestamp: 1 }) // 按时间升序排列
            .limit(50) // 限制返回数量
            .toArray();

        return res.status(200).json({ success: true, history });

    } catch (error) {
        console.error('History API Error:', error);
        // 返回更详细的错误信息帮助调试
        return res.status(500).json({ 
            success: false, 
            message: `无法从数据库加载历史记录。请检查 MONGODB_URI 配置和 MongoDB 网络访问权限。`,
            error: error.message
        });
    }
}