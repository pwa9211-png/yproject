// pages/api/history.js
// 🚨 最终路径修正: 使用 '../../lib/mongo'
import { connectToMongo } from '../../lib/mongo';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    // 假设前端通过查询参数获取房间号
    const { room } = req.query; 

    if (!room) {
        return res.status(400).json({ success: false, message: 'Missing required query parameter: room.' });
    }

    try {
        const { ChatMessage } = await connectToMongo();

        // --- 从数据库查询历史记录 (使用 room 字段进行过滤) ---
        const history = await ChatMessage.find({ room }) // 确保了按 room 过滤
            .sort({ timestamp: 1 }) // 按时间升序排列
            .limit(50) // 限制返回数量
            .toArray();

        return res.status(200).json({ success: true, history });

    } catch (error) {
        console.error('History API Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: `无法从数据库加载历史记录。`,
            error: error.message
        });
    }
}