// pages/api/history.js

import { connectToMongo } from '../../lib/mongodb'; 

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender } = req.query; // 从前端接收 room 和 sender

    if (!room || !sender) {
        return res.status(400).json({ success: false, message: 'Missing required fields: room or sender.' });
    }

    // --- 🚨 权限控制逻辑 START ---
    if (room === RESTRICTED_ROOM) {
        if (!ALLOWED_USERS.includes(sender)) {
            // 立即拒绝非白名单用户获取历史记录
            return res.status(403).json({
                success: false,
                message: `对不起，房间 ${RESTRICTED_ROOM} 是限制房间。您无权查看历史对话。请换个房间。`,
                history: [] 
            });
        }
    }
    // --- 权限控制逻辑 END ---

    try {
        const { ChatMessage } = await connectToMongo();

        const history = await ChatMessage.find({ room })
            .sort({ timestamp: 1 })
            .toArray();

        return res.status(200).json({ success: true, history });

    } catch (error) {
        console.error('History API Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}