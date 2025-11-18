import clientPromise from '../../lib/mongodb'; // 导入优化的连接管理

export default async function handler(req, res) {
  // 仅接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.body;

  if (!room) {
    return res.status(400).json({ message: 'Missing required field: room.' });
  }

  let client;
  try {
    client = await clientPromise;
    const db = client.db('chatDB');
    const messagesCollection = db.collection('messages');
    
    // 还需要清除 userStatus collection 中该房间的所有心跳记录，以完全重置房间状态
    const statusCollection = db.collection('userStatus'); 

    // 删除当前房间下的所有消息记录
    const resultMessages = await messagesCollection.deleteMany({ room });
    
    // 删除当前房间下的所有心跳记录
    const resultStatus = await statusCollection.deleteMany({ room });

    res.status(200).json({ 
        success: true, 
        message: `房间 ${room} 中 ${resultMessages.deletedCount} 条消息和 ${resultStatus.deletedCount} 条心跳记录已被清除。`,
        deletedCount: resultMessages.deletedCount
    });

  } catch (error) {
    console.error('Clear History API Error:', error);

    res.status(500).json({ 
        message: '无法清空历史记录。请检查数据库连接和lib/mongodb.js配置。', 
        details: error.message 
    });
  }
}