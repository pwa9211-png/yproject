import { MongoClient } from 'mongodb';

// MongoDB 配置
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.query;

  if (!room) {
    return res.status(400).json({ message: 'Missing required query parameter: room.' });
  }

  try {
    await client.connect();
    const db = client.db('chatDB');
    const statusCollection = db.collection('userStatus'); 

    // 获取该房间所有用户的状态
    const userStatuses = await statusCollection.find({ room: room }, { projection: { _id: 0, room: 0 } }).toArray();

    res.status(200).json(userStatuses);

  } catch (error) {
    console.error('Online Status API Error:', error);

    res.status(500).json({ 
        message: '无法获取在线状态列表。', 
        details: error.message 
    });
  } finally {
    // await client.close(); 
  }
}