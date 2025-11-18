// pages/api/online-status.js
import clientPromise from '../../lib/mongodb'; // <-- 导入新连接

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.query;

  if (!room) {
    return res.status(400).json({ message: 'Missing required query parameter: room.' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('chatDB');
    const statusCollection = db.collection('userStatus'); 

    // 获取该房间所有用户的状态
    const userStatuses = await statusCollection.find({ room: room }, { projection: { _id: 0, room: 0 } }).toArray();

    res.status(200).json(userStatuses);

  } catch (error) {
    console.error('Online Status API Error:', error);

    res.status(500).json({ 
        message: '无法获取在线状态列表。请检查数据库连接和lib/mongodb.js配置。', 
        details: error.message 
    });
  }
  // 移除 client.close()
}