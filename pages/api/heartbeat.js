// pages/api/heartbeat.js
// 🚨 最终路径修正: 使用 '../../lib/mongo'
import { connectToMongo } from '../../lib/mongo'; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, username } = req.body;

  if (!room || !username) {
    return res.status(400).json({ message: 'Missing required fields: room or username.' });
  }

  try {
    const { OnlineUser } = await connectToMongo();
    
    // 1. 更新或插入用户的活跃时间
    await OnlineUser.updateOne(
      { room: room, sender: username }, // 使用 sender 字段保持一致
      { $set: { last_seen: new Date(), sender: username } }, 
      { upsert: true } 
    );

    res.status(200).json({ success: true, message: 'Heartbeat recorded.' });

  } catch (error) {
    console.error('Heartbeat API Error:', error);

    res.status(500).json({ 
        message: '无法记录心跳，请检查数据库连接和lib/mongo.js配置。', 
        details: error.message
    });
  }
}