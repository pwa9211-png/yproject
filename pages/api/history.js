import clientPromise from '../../lib/mongodb'; // 导入优化的连接管理

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room } = req.query;

  if (!room) {
    return res.status(400).json({ message: 'Missing required query parameter: room.' });
  }

  let client;
  try {
    client = await clientPromise;
    const db = client.db('chatDB');
    const messagesCollection = db.collection('messages');

    // 查找该房间的所有历史消息，按时间升序排列
    const messages = await messagesCollection
      .find({ room: room })
      .sort({ timestamp: 1 })
      .toArray();

    res.status(200).json({ messages: messages });

  } catch (error) {
    console.error('History API Error:', error);

    res.status(500).json({ 
      message: '无法加载历史记录。请检查数据库连接和lib/mongodb.js配置。', 
      details: error.message 
    });
  }
}