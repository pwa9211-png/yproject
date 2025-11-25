// pages/api/export-history.js

import { connectToMongo } from '../../lib/mongodb'; 

const AI_SENDER_NAME = '万能助理';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender } = req.query;

    if (!room || !sender) {
        return res.status(400).json({ success: false, message: 'Missing required fields: room or sender.' });
    }

    try {
        const { ChatMessage } = await connectToMongo();

        // 1. 获取聊天历史
        const history = await ChatMessage.find({ room })
            .sort({ timestamp: 1 })
            .toArray();

        // 2. 格式化为 HTML
        const messagesHtml = history.map(msg => {
            const isUser = msg.sender === sender;
            const isAI = msg.sender.replace(/\*/g, '') === AI_SENDER_NAME.replace(/\*/g, ''); 
            const messageClass = isUser ? 'user-message' : 'other-message';
            const floatStyle = isUser ? 'float: right; clear: both;' : 'float: left; clear: both;';
            const alignStyle = isUser ? 'text-align: right;' : 'text-align: left;';
            const senderColor = isUser ? '#075e54' : (isAI ? '#0070f3' : '#333'); // 区分 AI 颜色

            return `
            <div class="message-container ${messageClass}" style="${floatStyle}">
                <div class="sender-name" style="${alignStyle} color: ${senderColor};">
                    ${msg.sender}
                </div>
                <div>${msg.message.replace(/\n/g, '<br/>')}</div>
                <div class="timestamp" style="${alignStyle}">${new Date(msg.timestamp).toLocaleString('zh-CN')}</div>
            </div>
            `;
        }).join('\n');

        const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>聊天记录导出 - 房间: ${room}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 0 10px; }
        .message-container { 
            margin-bottom: 10px; 
            padding: 10px; 
            border-radius: 8px; 
            max-width: 70%; 
            word-wrap: break-word; 
            line-height: 1.6;
            box-shadow: 0 1px 1px rgba(0,0,0,0.1);
        }
        .user-message { background-color: #e1ffc7; margin-left: auto; text-align: left; }
        .other-message { background-color: #ffffff; margin-right: auto; text-align: left; }
        .sender-name { font-weight: bold; margin-bottom: 5px; font-size: 0.9em; color: #555; }
        .timestamp { font-size: 0.7em; color: #888; margin-top: 5px; display: block; }
        h1 { border-bottom: 2px solid #ccc; padding-bottom: 5px; }
        hr { clear: both; visibility: hidden; }
    </style>
</head>
<body>
    <h1>聊天记录 - 房间: ${room}</h1>
    <p>导出用户: ${sender} / 导出时间: ${new Date().toLocaleString('zh-CN')}</p>
    <hr/>
    ${messagesHtml}
</body>
</html>`;

        // 3. 设置响应头并发送文件
        const filename = `chat_export_${room}_${new Date().toISOString().slice(0, 10)}.html`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(fullHtml);

    } catch (error) {
        console.error('Export History API Error:', error);

        res.status(500).json({ 
            message: '导出历史记录失败，请检查数据库连接或权限。',
            details: error.message
        });
    }
}