// pages/api/online-status.js
import { connectToMongo } from '../../lib/mongodb'; // 确保路径正确

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { room } = req.query;

    if (!room) {
        return res.status(400).json({ message: 'Missing room parameter' });
    }

    try {
        const { OnlineUser } = await connectToMongo();

        // 计算 "在线" 的阈值 (例如过去 60 秒内有心跳的用户)
        const threshold = new Date(Date.now() - 60 * 1000);

        // 查询该房间内，且 last_seen 大于阈值的用户
        const members = await OnlineUser.find({ 
            room: room,
            last_seen: { $gt: threshold }
        }).toArray();

        res.status(200).json({ members });

    } catch (error) {
        console.error('Online Status API Error:', error);
        res.status(500).json({ message: 'Internal Server Error', details: error.message });
    }
}