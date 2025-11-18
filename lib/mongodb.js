// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  // 保持客户端连接的活力，提高 serverless 环境效率
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 45000,
};

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // 在开发环境中使用全局变量缓存 MongoClient 实例
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri, options);
    global._mongoClientPromise = global._mongoClient.connect();
  }
  client = global._mongoClient;
  clientPromise = global._mongoClientPromise;
} else {
  // 在生产环境 (Vercel) 中直接创建实例
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// clientPromise 包含已连接的 MongoDB 客户端
export default clientPromise;