// pages/api/heartbeat.js
// 🚨 修正导入: 使用 '../../lib/mongodb'
import { connectToMongo } from '../../lib/mongodb'; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, username } = req.body;

  if (!room || !username) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const { OnlineUser } = await connectToMongo();
    
    await OnlineUser.updateOne(
      { room: room, sender: username },
      { $set: { last_seen: new Date(), sender: username } }, 
      { upsert: true } 
    );

    res.status(200).json({ success: true });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}