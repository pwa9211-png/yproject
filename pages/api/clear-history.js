import { MongoClient } from 'mongodb';

// MongoDB 配置
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri); 

export default async function handler(req, res) {
  // 仅接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.body;

  if (!room) {
    return res.status(400).json({ message: 'Missing required field: room.' });
  }

  try {
    await client.connect();
    const db = client.db('chatDB');
    const messagesCollection = db.collection('messages');

    // 删除当前房间下的所有消息记录
    const result = await messagesCollection.deleteMany({ room });

    res.status(200).json({ 
        success: true, 
        message: `房间 ${room} 中 ${result.deletedCount} 条消息已被清除。`,
        deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Clear History API Error:', error);

    res.status(500).json({ 
        message: '无法清空历史记录。请检查 MONGODB_URI 配置和网络访问权限。', 
        details: error.message 
    });
  } finally {
    await client.close();
  }
}