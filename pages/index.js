// pages/index.js (React Component for the main page)

import Head from 'next/head';
import React from 'react';

// --- 前端 JavaScript 逻辑封装 ---
// 这个组件包含了所有处理聊天室加入、消息发送、轮询获取新消息的纯 JavaScript 代码。
const FrontEndScript = () => {
    return (
        <script
            // 使用 dangerouslySetInnerHTML 来嵌入纯 JS，使其在浏览器中执行
            dangerouslySetInnerHTML={{
                __html: `
                let currentRoomId = null;
                let currentNickname = null;
                let lastMessageCount = 0; 
                const AI_NAME = '环球智囊';
                const SYSTEM_PROMPT = "你是一位资深且专业的旅行规划师。你的任务是根据两位用户的对话，为他们提供有创意、详细、切合实际的旅行建议和行程规划。你的回复应该专业、友善、富有条理，并能针对用户提出的不同需求（如预算、偏好、时间）提供定制化的解决方案。每次回复都要考虑到两位用户的发言上下文。";
                const messageHistory = []; 
                let pollingInterval;
                let isSending = false;

                function appendMessage(sender, content, type) {
                    const chatWindow = document.getElementById('chat-window');
                    
                    const role = type === 'ai' ? 'assistant' : 'user';
                    // 确保发送给 AI 的内容带有发送者信息，用于多轮对话上下文
                    const messageContentForAI = type === 'ai' ? content : sender + ' 说: ' + content; 
                    
                    // 仅将有效的用户和AI消息添加到历史中（避免重复添加）
                    if (sender !== '系统' && (messageHistory.length === 0 || messageHistory[messageHistory.length - 1].content !== messageContentForAI)) {
                        messageHistory.push({ role: role, content: messageContentForAI });
                    }

                    // 创建消息 DOM 元素
                    const msgDiv = document.createElement('div');
                    msgDiv.className = type === 'ai' ? 'message message-ai' : 'message message-user';

                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'message-content';

                    let senderDisplay = type === 'ai' ? ' (' + AI_NAME + ')' : ' (' + sender + ')';
                    if (type === 'system') {
                        senderDisplay = '系统提示';
                        contentDiv.style.backgroundColor = '#ffcdd2';
                        contentDiv.style.color = '#333';
                        contentDiv.style.fontWeight = 'bold';
                    }
                    
                    contentDiv.innerHTML = '<strong>' + senderDisplay + '</strong><br>' + content;
                    msgDiv.appendChild(contentDiv);
                    
                    chatWindow.appendChild(msgDiv);
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                }
                
                async function fetchNewMessages(isInitialization = false) {
                    if (!currentRoomId) return;
                    
                    try {
                        const response = await fetch('/api/history?room_id=' + currentRoomId);
                        if (!response.ok) throw new Error('无法连接 API');

                        const data = await response.json();
                        const allMessages = data.messages || []; 
                        
                        if (isInitialization) {
                            // 清空 DOM 和本地历史记录
                            document.getElementById('chat-window').innerHTML = '';
                            messageHistory.length = 0; 
                            lastMessageCount = 0;
                        }

                        if (allMessages.length > lastMessageCount) {
                            // 遍历并显示新消息
                            for (let i = lastMessageCount; i < allMessages.length; i++) {
                                const msg = allMessages[i];
                                appendMessage(msg.sender, msg.content, msg.type); 
                            }
                            lastMessageCount = allMessages.length;
                        }
                    } catch (error) {
                        console.error('获取新消息出错:', error);
                        if (isInitialization) {
                             appendMessage('系统', '无法加载聊天历史，请检查后端配置和网络连接。', 'system');
                        }
                    }
                }

                async function fetchHistoryAndInitialize() {
                    await fetchNewMessages(true);
                    
                    if (lastMessageCount === 0) {
                         appendMessage('系统', '欢迎 ' + currentNickname + ' 加入房间 ' + currentRoomId + '。我是环球智囊，很高兴能为二位规划旅行！请开始吧。', 'system');
                    }
                }
                
                function startPolling() {
                     if (pollingInterval) clearInterval(pollingInterval);
                     // 启动定时轮询，每 3 秒检查一次新消息
                     pollingInterval = setInterval(fetchNewMessages, 3000); 
                }
                
                // --- 挂载到 window，供 React 组件调用 ---
                window.joinChat = function() { 
                    currentNickname = document.getElementById('nickname').value.trim();
                    currentRoomId = document.getElementById('room-id').value.trim();

                    if (!currentNickname || !currentRoomId) {
                        alert('请填写称呼和聊天室号码！');
                        return;
                    }

                    document.getElementById('join-form').style.display = 'none';
                    document.getElementById('chat-area').style.display = 'flex';
                    document.getElementById('current-room-id').textContent = currentRoomId;

                    fetchHistoryAndInitialize();
                    startPolling();
                }

                window.sendMessage = async function() { 
                    if (isSending) return;

                    const userInput = document.getElementById('user-input');
                    const message = userInput.value.trim();
                    userInput.value = '';

                    if (message === '' || !currentRoomId || !currentNickname) return;

                    isSending = true;
                    userInput.disabled = true;
                    
                    const currentMessage = { role: 'user', content: currentNickname + ' 说: ' + message };
                    // 构造发送给 AI 的完整历史记录
                    const historyForAI = [...messageHistory, currentMessage]; 
                    
                    try {
                        const response = await fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                room_id: currentRoomId,
                                nickname: currentNickname,
                                message: message,
                                history: historyForAI, 
                                system_prompt: SYSTEM_PROMPT 
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error('API 请求失败: ' + (errorData.message || response.statusText));
                        }

                        // AI 回复完成后，立即手动触发一次历史更新，确保消息被显示
                        await fetchNewMessages(); 

                    } catch (error) {
                        console.error('发送消息或获取 AI 回复出错:', error);
                        appendMessage('系统', '发送失败，请稍后重试。原因: ' + error.message, 'system');
                    } finally {
                        isSending = false;
                        userInput.disabled = false;
                        userInput.focus();
                    }
                }
            `}}
        />
    );
};

// --- Next.js 页面主组件 ---
export default function Home() {
    return (
        <>
            <Head>
                <title>双人 AI 聊天室 - 环球智囊</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                {/* 使用 style jsx global 嵌入 CSS 样式 */}
                <style jsx global>{`
                    /* 将所有 CSS 样式放在这里 */
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 20px auto; padding: 0 20px; background-color: #f7f7f7; }
                    h2 { text-align: center; color: #333; }
                    #join-form { display: flex; gap: 10px; margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff; }
                    #join-form input, #join-form button { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
                    #join-form button { background-color: #007bff; color: white; cursor: pointer; transition: background-color 0.3s; }
                    #join-form button:hover { background-color: #0056b3; }
                    
                    #chat-area { display: flex; flex-direction: column; height: 65vh; border: 1px solid #ddd; border-radius: 8px; background-color: #fff; }
                    #chat-info { padding: 10px 15px; background-color: #e9ecef; border-bottom: 1px solid #ddd; font-size: 0.9em; }
                    
                    #chat-window { flex-grow: 1; overflow-y: scroll; padding: 15px; }
                    .message { margin-bottom: 10px; display: flex; }
                    .message-content { padding: 8px 12px; border-radius: 18px; max-width: 70%; line-height: 1.5; font-size: 0.95em; }
                    
                    .message-ai { justify-content: flex-start; }
                    .message-ai .message-content { background-color: #e6f7ff; border-top-left-radius: 0; color: #333; }
                    
                    .message-user { justify-content: flex-end; }
                    .message-user .message-content { background-color: #007bff; color: white; border-top-right-radius: 0; }
                    
                    #input-area { display: flex; padding: 10px; border-top: 1px solid #ddd; }
                    #user-input { flex-grow: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-right: 10px; }
                    #input-area button { padding: 10px 15px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
                    #input-area button:hover { background-color: #1e7e34; }
                `}</style>
            </Head>

            <main>
                <h2>✈️ 双人 AI 旅行规划聊天室</h2>
                
                <div id="join-form">
                    <input type="text" id="nickname" placeholder="您的称呼 (例如: 小王)" defaultValue="用户A" />
                    <input type="text" id="room-id" placeholder="聊天室号码 (例如: 123456)" defaultValue="123456" />
                    <button onClick={() => window.joinChat()}>加入/创建聊天室</button>
                </div>

                <div id="chat-area" style={{ display: 'none' }}>
                    <div id="chat-info">当前房间：<strong id="current-room-id"></strong> | AI 角色：**环球智囊**</div>
                    <div id="chat-window">
                        {/* 聊天消息将显示在这里 */}
                    </div>
                    <div id="input-area">
                        <input 
                            type="text" 
                            id="user-input" 
                            placeholder="输入您的消息..." 
                            // 监听回车键发送消息
                            onKeyPress={(e) => { if (e.key === 'Enter') window.sendMessage(); }}
                        />
                        <button onClick={() => window.sendMessage()}>发送</button>
                    </div>
                </div>
            </main>
            
            {/* 插入前端逻辑脚本 */}
            <FrontEndScript />
        </>
    );
}