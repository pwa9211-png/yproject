import { MongoClient } from 'mongodb';

// MongoDB 配置
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, username } = req.body;

  if (!room || !username) {
    return res.status(400).json({ message: 'Missing required fields: room or username.' });
  }

  try {
    await client.connect();
    const db = client.db('chatDB');
    // 使用新的 collection 来存储用户的实时状态
    const statusCollection = db.collection('userStatus'); 

    // 1. 更新或插入用户的活跃时间
    await statusCollection.updateOne(
      { room: room, username: username }, // 查询条件：房间和用户名
      { $set: { lastActive: new Date() } }, // 更新内容：当前时间
      { upsert: true } // 如果不存在就插入
    );

    res.status(200).json({ success: true, message: 'Heartbeat recorded.' });

  } catch (error) {
    console.error('Heartbeat API Error:', error);

    res.status(500).json({ 
        message: '无法记录心跳，请检查数据库连接。', 
        details: error.message 
    });
  } finally {
    // 注意：在 Vercel 中，连接可能会被复用，但为了安全关闭。
    // await client.close(); 
  }
}