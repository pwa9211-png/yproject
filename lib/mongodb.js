// lib/mongodb.js
import { MongoClient, ServerApiVersion } from 'mongodb';

// 从 Vercel 环境变量中获取连接字符串
const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let client;
let clientPromise;

// 在开发模式下，使用全局变量以防止在 HMR（热模块替换）期间由于模块重新加载而耗尽数据库连接限制。
if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // 在生产模式下，最好不要使用全局变量。
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// 导出一个辅助函数来获取数据库和集合，方便 API 使用
export async function connectToMongo() {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DATABASE || 'chat_app');
    
    const ChatMessage = db.collection('chat_messages');
    const OnlineUser = db.collection('online_users');

    // 确保索引存在 (这操作是幂等的，即如果存在不会重复创建)
    // 1. 聊天记录索引
    await ChatMessage.createIndex({ room: 1, timestamp: -1 }); 
    // 2. 在线用户索引
    await OnlineUser.createIndex({ room: 1, sender: 1 }, { unique: true });
    // 3. 心跳过期索引 (60秒后自动删除)
    await OnlineUser.createIndex({ last_seen: 1 }, { expireAfterSeconds: 60 });

    return { 
        db, 
        ChatMessage, 
        OnlineUser,
        client 
    };
}

export default clientPromise;