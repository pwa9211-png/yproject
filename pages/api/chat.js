import { MongoClient } from 'mongodb';
import OpenAI from 'openai';

// MongoDB 配置
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Kimi Chat 配置
const kimiApiKey = process.env.MOONSHOT_API_KEY;
// 使用 MOONSHOT_BASE_URL 变量，如果没有设置，则使用 Kimi 的默认 API 地址
const kimiBaseUrl = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'; 

// 实例化 OpenAI 客户端，但配置为连接 Kimi 的 API
const kimi = new OpenAI({
  apiKey: kimiApiKey,
  baseURL: kimiBaseUrl,
});

export default async function handler(req, res) {
  // 仅接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { room, sender, message, aiRole } = req.body;

  if (!room || !sender || !message || !aiRole) {
    return res.status(400).json({ message: 'Missing required fields: room, sender, message, or aiRole.' });
  }

  try {
    await client.connect();
    const db = client.db('chatDB');
    const messagesCollection = db.collection('messages');

    // 1. 保存用户发送的消息到数据库
    const userMessage = {
      room,
      sender,
      message,
      timestamp: new Date(),
      role: 'user',
    };
    await messagesCollection.insertOne(userMessage);

    // 2. 获取历史消息（最多 N 条）
    const historyMessages = await messagesCollection.find({ room })
      .sort({ timestamp: -1 }) // 按时间倒序
      .limit(10) // 限制获取最近10条消息
      .toArray();

    // 3. 构建 Kimi Chat API 所需的消息格式
    // 角色定义：系统角色 + 历史消息
    const systemPrompt = `你是一个专业的旅行规划AI，你的名字是“${aiRole}”。你的任务是根据用户的需求，为他们提供旅行建议、行程规划或回答相关问题。`;

    // 格式化历史消息，确保角色正确
    const messagesForApi = historyMessages.reverse().map(msg => ({ // 倒序回来，保证时间顺序
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.message,
    }));

    // 插入系统提示和当前用户消息
    messagesForApi.unshift({
      role: 'system',
      content: systemPrompt,
    });
    messagesForApi.push({
        role: 'user',
        content: message,
    });
    
    // 4. 调用 Kimi Chat API 获取回复
    const completion = await kimi.chat.completions.create({
      // 使用 Kimi 推荐的模型，您可以根据需求更换
      model: "moonshot-v1-8k", 
      messages: messagesForApi,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const aiResponseMessage = completion.choices[0].message.content;

    // 5. 保存 AI 的回复到数据库
    const aiMessage = {
      room,
      sender: aiRole,
      message: aiResponseMessage,
      timestamp: new Date(),
      role: 'assistant',
    };
    await messagesCollection.insertOne(aiMessage);

    // 6. 返回成功响应
    res.status(200).json({ 
      success: true, 
      aiResponse: aiResponseMessage 
    });

  } catch (error) {
    console.error('Chat API Error:', error);

    // 特别处理 API Key 或配额错误，以便在日志中更清晰
    if (error.status === 401 || error.status === 429) {
         res.status(500).json({ message: 'API Error: 请检查 Kimi API Key 是否有效或配额是否用尽。', details: error.message });
    } else {
         res.status(500).json({ message: '服务器处理错误，请检查日志。', details: error.message });
    }
  } finally {
    await client.close();
  }
}