// lib/ai.js

import { GoogleGenerativeAI } from "@google/genai";
import { MoonshotClient } from '@moonshot-ai/api';

// 检查是否使用 MOONSHOT_API_KEY
const useMoonshot = process.env.MOONSHOT_API_KEY && process.env.MOONSHOT_BASE_URL;

// 初始化 AI 客户端
let aiClient;
if (useMoonshot) {
    aiClient = new MoonshotClient({
        apiKey: process.env.MOONSHOT_API_KEY,
        baseURL: process.env.MOONSHOT_BASE_URL,
    });
    console.log("AI Client initialized: Moonshot (Kimi)");
} else if (process.env.OPENAI_API_KEY) {
    // 假设您可能使用 OpenAI API
    // 在这里添加 OpenAI 或其他客户端的初始化代码 (如果需要)
    console.log("AI Client initialized: OpenAI (Placeholder)");
    // 暂时用 GoogleGenerativeAI 代替，因为 chat.js 中预期的是 GoogleGenAI 函数
    // ⚠️ 注意：如果使用 OpenAI，您需要安装相应的包，并调整 GoogleGenAI 函数的实现。
    // 为了使 chat.js 立即工作，我们使用 Google Generative AI 的代码结构。
    aiClient = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || 'dummy-key');
    console.log("AI Client initialized: Google Generative AI (using fallback KEY)");
} else {
    // 默认使用 Google Generative AI (需要确保已安装 @google/genai)
    aiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("AI Client initialized: Gemini");
}

/**
 * 调用 GoogleGenAI (或 Moonshot) 进行聊天补全
 * @param {Array<Object>} history - 聊天历史记录
 * @param {string} aiRole - AI 的角色设定
 * @returns {Promise<string>} AI 的回复文本
 */
export async function GoogleGenAI(history, aiRole) {
    const systemInstruction = `你是一个多功能聊天室里的助手，你的当前角色是 ${aiRole}。你的职责是根据用户的消息和聊天历史给出相关的回复。如果用户使用 /设定角色 命令，你应回复“角色设定成功”并记住新的角色。`;
    
    // 格式化历史记录为 Moonshot/OpenAI/Gemini 兼容的 messages 数组
    const messages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', // Moonshot/OpenAI 使用 assistant
        content: item.text,
    }));
    
    // 移除系统指令，如果它存在于 history 中 (通常不应存在)
    const finalMessages = messages.filter(m => m.role !== 'system');


    try {
        let completion;
        
        if (useMoonshot) {
            // --- Moonshot 客户端调用 ---
            completion = await aiClient.chat.completions.create({
                model: 'moonshot-v1-8k', // 使用 Moonshot 模型
                messages: [
                    { role: "system", content: systemInstruction },
                    ...finalMessages
                ],
                temperature: 0.7,
            });
            return completion.choices[0].message.content;
            
        } else {
            // --- Google Generative AI 客户端调用 (Fallback/Default) ---
            const model = aiClient.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.7,
                }
            });

            // 格式化历史记录为 Google GenAI 格式
            const geminiHistory = finalMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));
            
            const chat = model.startChat({
                history: geminiHistory,
            });

            const userMessage = finalMessages[finalMessages.length - 1].content;
            const response = await chat.sendMessage({ message: userMessage });
            
            return response.text;
        }

    } catch (error) {
        console.error("AI Generation Error:", error);
        return `对不起，AI 模型调用失败。错误信息：${error.message}`;
    }
}