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

    // --- 🚨 权限控制逻辑 START ---
    if (room === RESTRICTED_ROOM) {
        if (!ALLOWED_USERS.includes(sender)) {
            // 立即拒绝非白名单用户查看在线列表
            return res.status(403).json({
                success: false,
                message: `房间 ${RESTRICTED_ROOM} 是限制房间。您无权查看在线成员。`,
                members: [] 
            });
        }
    }
    // --- 权限控制逻辑 END ---

    try {
        const { OnlineUser } = await connectToMongo();

        // 查找在过去 60 秒内更新过心跳的用户
        const members = await OnlineUser.find({ room, last_seen: { $gt: new Date(Date.now() - 60000) } }).toArray();

        // 返回 sender 列表
        const memberList = members.map(m => ({ sender: m.sender }));

        return res.status(200).json({ success: true, members: memberList });

    } catch (error) {
        console.error('Online Status API Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}