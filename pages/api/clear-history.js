// pages/api/clear-history.js
// 🚨 修正导入：使用我们统一的 connectToMongo 函数，路径修正为 ../../lib/mongodb
import { connectToMongo } from '../../lib/mongodb'; 

export default async function handler(req, res) {
  // 仅接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.body;

  if (!room) {
    return res.status(400).json({ message: 'Missing required field: room.' });
  }

  // --- 权限检查 (可选，但推荐保留) ---
  const RESTRICTED_ROOM = '2';
  const ALLOWED_USERS = ['Didy', 'Shane']; 
  
  // 清空操作是敏感的，如果需要限制，需要前端传递 sender 字段
  // 假设只有白名单用户可以清空房间 2 的历史记录
  // const { sender } = req.body; // 如果需要检查发送者，取消注释此行，并修改前端调用
  /*
  if (room === RESTRICTED_ROOM && (!sender || !ALLOWED_USERS.includes(sender))) {
      return res.status(403).json({ success: false, message: '权限不足，无法清空此房间历史记录。' });
  }
  */
  // --- 权限检查 END ---


  try {
    // 确保 connectToMongo 返回 ChatMessage 和 OnlineUser 集合
    const { ChatMessage, OnlineUser } = await connectToMongo();

    // 1. 删除当前房间下的所有消息记录
    const resultMessages = await ChatMessage.deleteMany({ room });
    
    // 2. 删除当前房间下的所有心跳记录
    const resultStatus = await OnlineUser.deleteMany({ room });

    res.status(200).json({ 
        success: true, 
        message: `房间 ${room} 中 ${resultMessages.deletedCount} 条消息和 ${resultStatus.deletedCount} 条心跳记录已被清除。`,
        deletedCount: resultMessages.deletedCount
    });

  } catch (error) {
    console.error('Clear History API Error:', error);

    res.status(500).json({ 
        message: '无法清空历史记录，请检查数据库连接和lib/mongodb.js配置。', 
        details: error.message
    });
  }
}