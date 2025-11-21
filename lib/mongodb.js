// lib/mongodb.js

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

/**
 * 确保 MongoDB 连接并返回所需的 Collection 实例。
 */
export async function connectToMongo() { // 使用具名导出：connectToMongo
    // 如果已经连接，直接返回集合
    if (db) return { db, ChatMessage, OnlineUser };

    try {
        // 连接到服务器
        await client.connect();
        
        // 选择数据库 (默认使用 'chat_app' 或根据 URI 中的名称)
        db = client.db(process.env.MONGODB_DATABASE || 'chat_app'); 

        // 定义 Collection 实例 (统一使用这两个集合名称)
        ChatMessage = db.collection('chat_messages');
        OnlineUser = db.collection('online_users');

        // 创建索引（只在首次连接时创建）
        await ChatMessage.createIndex({ room: 1 }).catch(() => {});
        await OnlineUser.createIndex({ room: 1, sender: 1 }, { unique: true }).catch(() => {});
        // TTL 索引：60秒未更新则过期
        await OnlineUser.createIndex({ last_seen: 1 }, { expireAfterSeconds: 60 }).catch(() => {}); 
        
        return { db, ChatMessage, OnlineUser };

    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw new Error("Failed to connect to MongoDB.");
    }
}