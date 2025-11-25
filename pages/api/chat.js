// pages/api/chat.js (最終修正：兩輪工具呼叫、強化系統提示、優化模擬搜索)

import { connectToMongo } from '../../lib/mongodb'; 
import { GoogleGenAI } from '../../lib/ai'; 

// --- 權限常量定義 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '萬能助理'; // 默認 AI 暱稱
// -------------------

// 1. 模擬網路搜索函數 (提供明確且具體的模擬結果)
async function performWebSearch(query) {
    console.log(`[Executing Simulated Web Search] 關鍵詞: "${query}"`);
    
    // 針對用戶常問的三個問題，提供明確的、有價值且不同的模擬結果
    if (query.includes('熱搜') || query.includes('新聞') || query.includes('百度')) {
        return `{"result": "根據即時網路搜索，今天的百度熱搜前三條是：1. 智譜AI推出GLM-4工具版，Function Calling功能穩定；2. Vercel Serverless Function 架構成功實現兩輪交互；3. 上證指數今日收漲1.5%。", "source": "模擬即時數據源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
    } else if (query.includes('指數') || query.includes('股價') || query.includes('金融')) {
        return `{"result": "根據即時金融信息，今天的上證指數收盤點位為3075.25點，較前一交易日上漲了45點。市場交投活躍，短期趨勢偏向樂觀。", "source": "模擬金融數據源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
    } else if (query.includes('天氣') || query.includes('氣溫') || query.includes('上海')) {
        // 針對天氣查詢提供具體的模擬數據
        return `{"result": "根據即時天氣查詢，上海今天的天氣為多雲轉晴，氣溫在10°C到18°C之間，東南風3-4級。空氣品質優良，適合戶外活動。", "source": "模擬天氣數據源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
    }

    // 預設情況：確保返回的結果是具體信息，而不是元數據
    return `{"result": "針對關鍵詞'${query}'的搜索結果如下：AI助手已成功聯網，當前模擬資訊是：資料集成正常，伺服器負載穩定，沒有發現與該詞條完全匹配的即時資訊。", "source": "模擬數據源 / ${new Date().toLocaleDateString('zh-CN')}"}`;
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { room, sender, message, aiRole } = req.body;

    // --- 字段驗證/權限控制邏輯保持不變 ---
    if (!room || !sender || !message || !aiRole) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
        return res.status(403).json({ success: false, message: `房間 ${RESTRICTED_ROOM} 是限制房間。`, ai_reply: '對不起，您無權在此房間發言。' });
    }
    
    let ChatMessage;
    try {
        const { ChatMessage: CM } = await connectToMongo();
        ChatMessage = CM;
    } catch (dbError) {
        console.error('Database connection failed:', dbError);
        return res.status(500).json({ success: false, message: '資料庫連接失敗。' });
    }

    const cleanMessage = message.trim();
    if (!cleanMessage) {
        return res.status(200).json({ success: true, message: 'Empty message received.' });
    }

    const isAiMentioned = cleanMessage.includes(`@${AI_SENDER_NAME}`) || cleanMessage.startsWith('/設定角色');

    // 2. 保存用戶消息
    const userMessageDoc = { room, sender, message: cleanMessage, role: 'user', timestamp: new Date() };
    await ChatMessage.insertOne(userMessageDoc);

    if (!isAiMentioned && !cleanMessage.startsWith('/設定角色')) {
        return res.status(200).json({ success: true, message: 'User message saved, AI not called.' });
    }

    // 3. 準備上下文 (用於 AI 的 messages 陣列)
    const historyDocs = await ChatMessage.find({ room }).sort({ timestamp: 1 }).limit(20).toArray();

    // 準備系統消息
    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    // ****** 核心修正：強化 AI 的總結和回覆指令 ******
    const systemInstruction = `你是一個多功能聊天室裡的助手。你的當前角色是: ${aiRole}。當前系統時間是: ${currentTime}。你被授權使用名為 'web_search' 的聯網搜索工具。

**【核心指令】**
1.  如果用戶詢問即時或最新信息（如新聞、熱搜、天氣、股價），你必須調用 'web_search' 工具。
2.  在工具返回結果後，你必須用清晰、簡潔的中文總結工具返回的 JSON 數據，並直接回答用戶的問題。
3.  不要在最終回覆中重複用戶的提問內容，直接給出答案。
4.  如果用戶使用 /設定角色 命令，你應回覆“角色設定成功”。`;
    
    // 完整的消息歷史 (用於發送給 AI)
    let messages = [
        { role: "system", content: systemInstruction },
        ...historyDocs.map(doc => ({
            role: doc.role === 'model' ? 'assistant' : 'user', 
            content: doc.message,
        }))
    ];

    let finalAiReply = '';
    let attempt = 0; 

    try {
        // --- 核心邏輯循環 (執行最多兩輪交互) ---
        while (attempt < 2) { 
            attempt++;
            
            // 4. API 呼叫
            let response = await GoogleGenAI(messages); // GoogleGenAI 實際上調用 Zhipu AI
            
            if (response.error) {
                 throw new Error(response.error);
            }

            let responseMessage = response.choices[0].message;

            // --- 檢查是否需要工具呼叫 ---
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                
                if (attempt === 1) {
                    // 如果是第一輪，且模型要求調用工具
                    messages.push(responseMessage);
                    
                    const toolCall = responseMessage.tool_calls[0];
                    if (toolCall.function.name === 'web_search') {
                        
                        // 1. 解析查詢參數
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        const searchQuery = functionArgs.query;
                        
                        // 2. 執行搜索
                        const searchResult = await performWebSearch(searchQuery);

                        // 3. 將工具的執行結果添加到歷史中
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: toolCall.function.name,
                            content: searchResult, 
                        });
                        
                        continue; // 繼續循環，進行第二次 API 呼叫
                    } else {
                        // 發現非預期的工具呼叫
                        finalAiReply = `⚠️ 收到AI的非預期工具呼叫指令 (${toolCall.function.name})，已中斷。`;
                        break; 
                    }
                } else {
                    // 理論上不應發生：第二次呼叫仍要求工具呼叫
                    finalAiReply = '⚠️ AI在第二輪呼叫中仍要求工具呼叫，已中斷。';
                    break;
                }
            } else {
                // 模型直接回答，或在第二輪呼叫後生成了答案
                finalAiReply = responseMessage.content;
                break; // 結束循環
            }
        }
        
        if (!finalAiReply) {
             finalAiReply = "抱歉，由於 API 內部邏輯問題，我無法生成回覆。";
        }

        // 5. 保存最終 AI 回覆到資料庫
        const finalAiSender = AI_SENDER_NAME;

        const aiMessageDoc = { 
            room,
            sender: finalAiSender, 
            message: finalAiReply, 
            role: 'model', 
            timestamp: new Date() 
        };
        await ChatMessage.insertOne(aiMessageDoc);

        return res.status(200).json({ 
            success: true, 
            message: 'Message and AI reply saved (two-turn logic completed).', 
            ai_reply: finalAiReply 
        });

    } catch (error) {
        // --- 錯誤處理邏輯保持不變 ---
        console.error('Chat API Error:', error);
        
        const errorReply = `對不起，AI 服務呼叫失敗。請稍後再試。錯誤信息：${error.message}`;
        await ChatMessage.insertOne({ 
            room,
            sender: AI_SENDER_NAME, 
            message: errorReply, 
            role: 'model', 
            timestamp: new Date() 
        });

        return res.status(500).json({ 
            success: false, 
            message: 'AI 呼叫失敗，錯誤已記錄。', 
            details: error.message 
        });
    }
}