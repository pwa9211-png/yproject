// pages/api/clear-history.js
// 🚨 最终路径修正: 使用 '../../lib/mongo'
import { connectToMongo } from '../../lib/mongo'; 

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
    const { ChatMessage, OnlineUser } = await connectToMongo();
    
    // 删除当前房间下的所有消息记录
    const resultMessages = await ChatMessage.deleteMany({ room });
    
    // 删除当前房间下的所有心跳记录
    const resultStatus = await OnlineUser.deleteMany({ room });

    res.status(200).json({ 
        success: true, 
        message: `房间 ${room} 中 ${resultMessages.deletedCount} 条消息和 ${resultStatus.deletedCount} 条在线记录已被清除。`,
        deletedCount: resultMessages.deletedCount
    });

  } catch (error) {
    console.error('Clear History API Error:', error);
    res.status(500).json({ 
        success: false,
        message: '无法清除历史记录。请检查数据库连接和配置。', 
        details: error.message 
    });
  }
}