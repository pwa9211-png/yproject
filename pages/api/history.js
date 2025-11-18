import { MongoClient } from 'mongodb';

// MongoDB 配置
const uri = process.env.MONGODB_URI;
// 注意：客户端连接对象必须在每次请求时重新创建或使用全局连接池。
// Vercel Serverless 环境推荐在 handler 内部或使用一个单独的连接函数。
// 为了简化，这里直接在文件顶部实例化，并在 try/finally 中连接/关闭。
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
    const db = client.db('chatDB'); // 假设数据库名为 chatDB
    const messagesCollection = db.collection('messages'); // 假设集合名为 messages

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
    // 在 Vercel Serverless 环境中，这是一个重要的清理步骤
    await client.close();
  }
}