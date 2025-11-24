// pages/api/online-status.js

import { connectToMongo } from '../../lib/mongodb'; 

const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender } = req.query; 

    if (!room || !sender) {
        return res.status(400).json({ success: false, message: 'Missing required fields: room or sender.' });
    }

    // --- 权限控制逻辑 ---
    if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
        return res.status(403).json({
            success: false,
            message: `房间 ${RESTRICTED_ROOM} 是限制房间。您无权查看在线成员。`,
            members: [] 
        });
    }
    // --- 权限控制逻辑 END ---

    try {
        const { OnlineUser } = await connectToMongo();

        // 查找在过去 60 秒内更新过心跳的用户 (TTL 索引的范围)
        const membersDocs = await OnlineUser.find({ room }).toArray();
        
        // 提取用户名
        const members = membersDocs.map(doc => doc.sender);

        res.status(200).json({ success: true, members });

    } catch (error) {
        console.error('Online Status API Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', details: error.message });
    }
}