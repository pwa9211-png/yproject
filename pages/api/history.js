import { MongoClient } from 'mongodb';

// MongoDB 配置
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri); 

export default async function handler(req, res) {
  // 仅接受 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.query;

  if (!room) {
    return res.status(400).json({ message: 'Missing required field: room.' });
  }

  try {
    await client.connect();
    const db = client.db('chatDB');
    const messagesCollection = db.collection('messages');

    // 查找房间内所有消息，并按时间戳升序排序 (确保正确的聊天顺序)
    const messages = await messagesCollection.find({ room })
      .sort({ timestamp: 1 })
      .toArray();

    // 成功返回消息历史
    res.status(200).json({ 
        success: true, 
        messages: messages.map(msg => ({
            room: msg.room,
            sender: msg.sender,
            message: msg.message,
            timestamp: msg.timestamp,
            role: msg.role,
        }))
    });

  } catch (error) {
    console.error('History API Error:', error);

    // 返回详细的服务器错误，以便前端显示错误信息
    res.status(500).json({ 
        message: '无法从数据库加载历史记录。请检查 MONGODB_URI 配置和 MongoDB 网络访问权限。', 
        details: error.message 
    });
  } finally {
    // 确保连接在请求结束后关闭
    await client.close();
  }
}