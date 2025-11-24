// lib/mongodb.js

import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI;

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
export async function connectToMongo() { 
    if (db) return { db, ChatMessage, OnlineUser };

    try {
        await client.connect();
        
        db = client.db(process.env.MONGODB_DATABASE || 'chat_app'); 

        // 统一 Collection 名称
        ChatMessage = db.collection('chat_messages');
        OnlineUser = db.collection('online_users');

        // 创建索引（避免重复创建时报错）
        await ChatMessage.createIndex({ room: 1 }).catch(() => {});
        await OnlineUser.createIndex({ room: 1, sender: 1 }, { unique: true }).catch(() => {});
        // TTL 索引 (60秒不更新自动移除)
        await OnlineUser.createIndex({ last_seen: 1 }, { expireAfterSeconds: 60 }).catch(() => {});

        console.log("MongoDB connected and collections/indices ensured.");

        return { db, ChatMessage, OnlineUser };

    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw new Error("Failed to connect to MongoDB.");
    }
}