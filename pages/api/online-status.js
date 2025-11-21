// pages/api/online-status.js

// 🚨 修正导入：使用统一的 connectToMongo 函数，确保路径正确
import { connectToMongo } from '../../lib/mongodb'; 
// 备注：虽然 online-status.js 不直接使用 AI，但如果项目中其他文件都找不到 '../../lib/ai'，
// 它可能会被 Next.js 的解析器误判。我们在此文件中不需要导入 ai 模块，但需要确保 mongodb 导入正确。

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender } = req.query; // 从前端接收 room 和 sender

    if (!room || !sender) {
        return res.status(400).json({ success: false, message: 'Missing required fields: room or sender.' });
    }

    // --- 权限控制逻辑 START ---
    const RESTRICTED_ROOM = '2';
    const ALLOWED_USERS = ['Didy', 'Shane']; 

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

        // 假设 OnlineUser 文档结构为 { room, sender, last_seen }
        const memberList = members.map(m => ({ sender: m.sender }));

        return res.status(200).json({ success: true, members: memberList });

    } catch (error) {
        console.error('Online Status API Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}