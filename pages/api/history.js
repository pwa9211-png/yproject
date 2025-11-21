// pages/api/history.js
// 🚨 修正导入: 使用 '../../lib/mongodb'
import { connectToMongo } from '../../lib/mongodb';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room } = req.query;

    if (!room) {
        return res.status(400).json({ success: false, message: 'Missing required query parameter: room.' });
    }

    try {
        const { ChatMessage } = await connectToMongo();

        const history = await ChatMessage.find({ room })
            .sort({ timestamp: 1 })
            .limit(50)
            .toArray();

        return res.status(200).json({ success: true, history });

    } catch (error) {
        console.error('History API Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Database Error',
            error: error.message
        });
    }
}