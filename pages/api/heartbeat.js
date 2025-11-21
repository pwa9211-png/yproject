// pages/api/heartbeat.js
// 🚨 修正导入：使用我们统一的 connectToMongo 函数
import { connectToMongo } from '../../lib/mongodb'; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, username } = req.body;

  if (!room || !username) {
    return res.status(400).json({ message: 'Missing required fields: room or username.' });
  }

  try {
    // 确保 connectToMongo 返回 OnlineUser 集合
    const { OnlineUser } = await connectToMongo(); 

    // 1. 更新或插入用户的活跃时间
    await OnlineUser.updateOne(
      { room: room, sender: username }, // 注意：我们统一使用 sender 作为用户名键名
      { $set: { last_seen: new Date() } }, // 注意：我们统一使用 last_seen 作为时间键名
      { upsert: true } 
    );

    res.status(200).json({ success: true, message: 'Heartbeat recorded.' });

  } catch (error) {
    console.error('Heartbeat API Error:', error);

    res.status(500).json({ 
        message: '无法记录心跳，请检查数据库连接和lib/mongodb.js配置。', 
        details: error.message
    });
  }
}