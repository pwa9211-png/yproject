// lib/mongo.js

import { MongoClient, ServerApiVersion } from 'mongodb';

// 从 Vercel 环境变量中获取连接字符串
const uri = process.env.MONGODB_URI;

// 创建一个 MongoDB 客户端
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;
let ChatMessage;
let OnlineUser;

async function connectToMongo() {
    if (db) return { db, ChatMessage, OnlineUser };

    try {
        // 连接到服务器
        await client.connect();
        
        // 选择数据库 (默认使用 'chat_app' 或根据 URI 中的名称)
        db = client.db(process.env.MONGODB_DATABASE || 'chat_app'); 

        // 定义聊天消息 Collection 和 Schema
        ChatMessage = db.collection('chat_messages');
        // 确保 room 字段有索引以提高查询速度
        await ChatMessage.createIndex({ room: 1 }); 

        // 定义在线用户 Collection 和 Schema
        OnlineUser = db.collection('online_users');
        // 确保 room 和 sender 字段有索引
        await OnlineUser.createIndex({ room: 1, sender: 1 }, { unique: true });
        // 确保 last_seen 字段用于过期/心跳 TTL 索引
        await OnlineUser.createIndex({ last_seen: 1 }, { expireAfterSeconds: 60 }); // 60秒未更新则过期

        console.log("Successfully connected to MongoDB and initialized collections.");

        return { db, ChatMessage, OnlineUser };
    } catch (e) {
        console.error("Failed to connect to MongoDB:", e);
        // 如果连接失败，抛出错误让应用知道
        throw new Error("Database connection failed. Check MONGODB_URI and network access.");
    }
}

export { connectToMongo };