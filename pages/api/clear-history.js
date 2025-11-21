// pages/api/clear-history.js
// 🚨 修正导入: 使用 '../../lib/mongodb'
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
    
    const resultMessages = await ChatMessage.deleteMany({ room });
    const resultStatus = await OnlineUser.deleteMany({ room });

    res.status(200).json({ 
        success: true, 
        message: `Cleared ${resultMessages.deletedCount} messages.`,
        deletedCount: resultMessages.deletedCount
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}