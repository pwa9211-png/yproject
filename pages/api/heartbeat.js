// pages/api/heartbeat.js
import clientPromise from '../../lib/mongodb'; // <-- 导入新连接

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, username } = req.body;

  if (!room || !username) {
    return res.status(400).json({ message: 'Missing required fields: room or username.' });
  }

  try {
    // 使用已连接的客户端
    const client = await clientPromise; 
    // 注意：MongoDB 数据库名称是从 MONGODB_URI 中解析出来的
    const db = client.db('chatDB'); 
    const statusCollection = db.collection('userStatus'); 

    // 1. 更新或插入用户的活跃时间
    await statusCollection.updateOne(
      { room: room, username: username }, 
      { $set: { lastActive: new Date() } }, 
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
  // 移除 client.close()
}