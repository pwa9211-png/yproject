// pages/api/clear-history.js

import { connectToMongo } from '../../lib/mongodb'; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.body;

  if (!room) {
    return res.status(400).json({ message: 'Missing required field: room.' });
  }

  try {
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
        message: '清空历史记录失败，请检查数据库连接。',
        details: error.message
    });
  }
}