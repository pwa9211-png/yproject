import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// --- 样式定义 ---
const styles = {
    container: { maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
    header: { textAlign: 'center', paddingBottom: '10px', marginBottom: '20px' },
    headerActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    actionButton: { padding: '8px 12px', marginLeft: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    chatWindow: { height: '400px', border: '1px solid #ccc', borderRadius: '8px', padding: '10px', overflowY: 'scroll', marginBottom: '10px', backgroundColor: '#f9f9f9' },
    message: { marginBottom: '10px', padding: '8px', borderRadius: '15px', maxWidth: '70%' },
    userMessage: { backgroundColor: '#007bff', color: 'white', marginLeft: 'auto', textAlign: 'right' },
    aiMessage: { backgroundColor: '#e9ecef', color: '#333', textAlign: 'left' },
    systemMessage: { textAlign: 'center', color: '#dc3545', marginBottom: '10px' },
    inputAreaWrapper: { position: 'relative', display: 'flex' },
    inputArea: { display: 'flex', flexGrow: 1 },
    input: { flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px 0 0 4px' },
    button: { padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' },
    userList: { position: 'fixed', top: '20px', right: '20px', width: '200px', border: '1px solid #ccc', padding: '10px', borderRadius: '8px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    userItem: { marginBottom: '5px', fontWeight: 'bold' },
    loginForm: { display: 'flex', flexDirection: 'column', gap: '15px', padding: '40px', border: '1px solid #eee', borderRadius: '10px', maxWidth: '400px', margin: '100px auto' },
    suggestionList: {
        position: 'absolute',
        bottom: '40px', 
        left: '0',
        width: 'calc(100% - 75px)', // 减去发送按钮的宽度
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 -2px 5px rgba(0,0,0,0.1)',
        zIndex: 10,
    },
    suggestionItem: {
        padding: '8px 10px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
        '&:hover': {
            backgroundColor: '#f0f0f0',
        }
    }
};
// --- 组件定义 ---

const aiRole = "环球智囊";
const POLLING_INTERVAL = 3000;

// 主应用组件，包含登录逻辑
export default function IndexPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [room, setRoom] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        if (username.trim() && room.trim()) {
            setIsLoggedIn(true);
        } else {
            alert('称呼和房间号都不能为空！');
        }
    };

    if (!isLoggedIn) {
        return (
            <div style={styles.container}>
                <Head><title>登录 - AI 聊天室</title></Head>
                <h1 style={{...styles.header, borderBottom: '2px solid #333'}}>AI 旅行规划聊天室 - 登录</h1>
                <form onSubmit={handleLogin} style={styles.loginForm}>
                    <input
                        type="text"
                        placeholder="请输入您的称呼 (例如: shane)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <input
                        type="text"
                        placeholder="请输入房间号 (例如: 123456)"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <button type="submit" style={{ ...styles.button, borderRadius: '4px' }}>进入房间</button>
                </form>
            </div>
        );
    }

    return <ChatRoom username={username} room={room} aiRole={aiRole} />;
}

// ChatRoom 组件
function ChatRoom({ username, room, aiRole }) {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState([]); 
    const [showSuggestions, setShowSuggestions] = useState(false); 
    const chatWindowRef = useRef(null);
    const lastMessageCountRef = useRef(0);
    const inputRef = useRef(null);

    // **轮询函数**：加载历史消息并更新成员列表
    const loadHistory = async (isManual = false) => {
        try {
            const res = await fetch(`/api/history?room=${room}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: '网络连接错误或服务器失败。' }));
                throw new Error(errorData.message || '网络连接错误或服务器失败。');
            }
            const data = await res.json();
            
            // 提取所有独特的发送者 (包括自己，但不包括 AI)
            const senders = new Set();
            data.messages.forEach(msg => {
                if (msg.role === 'user' && msg.sender) {
                    senders.add(msg.sender);
                }
            });
            const membersList = Array.from(senders);
            // 将 AI 加入到可选列表中
            if (!membersList.includes(aiRole)) {
                 membersList.push(aiRole); 
            }
            setOnlineMembers(membersList);
            
            const newMessages = [
                { role: 'system', message: `欢迎 ${username} 加入房间 ${room}。AI 角色: **${aiRole}**。` },
                ...data.messages,
            ];

            if (newMessages.length !== lastMessageCountRef.current || isManual) {
                 setMessages(newMessages);
                 lastMessageCountRef.current = newMessages.length;
            }

        } catch (error) {
            console.error('Error loading history:', error);
            if (lastMessageCountRef.current === 0) {
                 setMessages([
                    { role: 'system', message: `无法加载聊天历史，请检查后端配置和网络连接。错误信息: ${error.message}` },
                    { role: 'system', message: `欢迎 ${username} 加入房间 ${room}。我是 ${aiRole}，很高兴为您规划旅行！` },
                ]);
            }
        }
    };

    // 首次加载和轮询逻辑
    useEffect(() => {
        loadHistory(); 
        const intervalId = setInterval(() => {
            loadHistory();
        }, POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, [room, username, aiRole]); 
    
    // 自动滚动到底部
    useEffect(() => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    }, [messages]);
    
    // 处理输入框变化
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputMessage(value);

        // 检查输入框中最后一个字符是否是 @
        const lastChar = value.slice(-1);
        if (lastChar === '@') {
            setShowSuggestions(true);
        } else if (showSuggestions && !value.includes('@')) {
            setShowSuggestions(false);
        }
    };
    
    // 处理选择成员
    const handleSelectMember = (member) => {
        const newValue = inputMessage.replace(/@$/, '') + `@${member} `; 
        setInputMessage(newValue);
        setShowSuggestions(false);
        inputRef.current.focus();
    };

    const filteredMembers = onlineMembers.filter(member => member !== username);

    // 处理消息发送
    const handleSend = async () => {
        if (!inputMessage.trim() || isLoading) return;
        setShowSuggestions(false);

        const userMsg = { role: 'user', message: inputMessage.trim(), sender: username };
        setMessages(prev => [...prev, userMsg]); 
        setInputMessage('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room: room,
                    sender: username,
                    message: userMsg.message,
                    aiRole: aiRole,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: '未知服务器错误' }));
                throw new Error(errorData.message || `API 请求失败: ${res.status}`);
            }

            await loadHistory(true); 

        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, {
                role: 'system',
                message: `发送失败，请稍后重试。原因: ${error.message}`,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };
    
    // **导出对话记录处理函数 (HTML格式)**
    const handleExportChat = () => {
        // 1. 构建聊天内容的主体 HTML
        const chatContentHtml = messages.map(msg => {
            if (msg.role === 'system') {
                return `<p style="text-align: center; color: #dc3545; font-style: italic; font-family: Arial, sans-serif;">--- 系统提示: ${msg.message} ---</p>`;
            }
            
            const date = new Date(msg.timestamp || Date.now()).toLocaleTimeString('zh-TW', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            const isUser = msg.sender === username;
            
            // 使用内联样式模拟聊天气泡，保持与页面一致的左右对齐和颜色
            const messageStyle = `
                padding: 8px; 
                margin: 10px 0; 
                border-radius: 15px; 
                max-width: 70%; 
                word-wrap: break-word; 
                line-height: 1.5;
                font-family: Arial, sans-serif;
                ${isUser ? 
                    'background-color: #007bff; color: white; margin-left: auto; text-align: right;' : 
                    'background-color: #e9ecef; color: #333; text-align: left;'
                }
            `;
            
            return `
                <div style="${messageStyle}">
                    <strong>${msg.sender}</strong> (${date}):<br>
                    ${msg.message.replace(/\n/g, '<br>')}
                </div>
            `;
        }).join('\n');

        // 2. 构造完整的 HTML 页面
        const fullHtml = `
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>聊天室 ${room} 对话导出 - ${new Date().toISOString().slice(0, 10)}</title>
                <style>
                    body { max-width: 800px; margin: 20px auto; padding: 0 20px; }
                    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; font-family: Arial, sans-serif; }
                    p { font-family: Arial, sans-serif; }
                    .chat-log { border: 1px solid #ccc; padding: 20px; border-radius: 8px; }
                </style>
            </head>
            <body>
                <h1>AI 旅行规划聊天室 - 房间 ${room} 对话记录</h1>
                <p>导出日期: ${new Date().toLocaleString('zh-TW')}</p>
                <div class="chat-log">
                    ${chatContentHtml}
                </div>
            </body>
            </html>
        `;

        // 3. 创建 Blob 对象并触发下载
        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ChatRoom_${room}_Export_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('对话已成功导出为 HTML 文件，用浏览器打开即可查看。');
    };
    
    // **清空对话记录处理函数**
    const handleClearChat = async () => {
        if (!window.confirm(`确定要清空房间 ${room} 的所有 ${messages.length - 1} 条对话记录吗？此操作不可撤销！`)) {
            return;
        }

        try {
            const res = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: room }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: '未知服务器错误' }));
                throw new Error(errorData.message || `清除失败: ${res.status}`);
            }

            loadHistory(true); 
            alert('对话记录已成功清空！');

        } catch (error) {
            console.error('Error clearing chat:', error);
            alert(`清空失败: ${error.message}`);
        }
    };


    return (
        <>
            <Head><title>双人 AI 旅行规划聊天室</title></Head>
            <div style={styles.container}>
                <div style={styles.headerActions}>
                    <header style={{...styles.header, flexGrow: 1, borderBottom: '2px solid #333'}}>
                        <h1>
                            <span role="img" aria-label="user">👤</span>
                            <span role="img" aria-label="ai">🤖</span>
                            {" "}双人 AI 旅行规划聊天室
                        </h1>
                        <p>当前房间: **{room}** | AI 角色: **{aiRole}** ({username})</p>
                    </header>
                    <div>
                        <button onClick={handleExportChat} style={styles.actionButton}>
                            导出对话 (HTML)
                        </button>
                        <button onClick={handleClearChat} style={{...styles.actionButton, backgroundColor: '#dc3545'}}>
                            清空对话
                        </button>
                    </div>
                </div>


                <div style={styles.userList}>
                    <h4>在线成员 (基于历史记录)</h4>
                    {onlineMembers.filter(member => member !== aiRole).map(member => (
                         <p key={member} style={{ ...styles.userItem, color: member === username ? '#007bff' : '#000000' }}>
                            {member} {member === username ? '(你)' : ''}
                         </p>
                    ))}
                    <p style={{ ...styles.userItem, color: '#28a745' }}>{aiRole} (AI)</p>
                </div>

                <div style={styles.chatWindow} ref={chatWindowRef}>
                    {messages.map((msg, index) => {
                        if (msg.role === 'system') {
                            return (<div key={index} style={styles.systemMessage}>系统提示: {msg.message}</div>);
                        }
                        const isUser = msg.sender === username;
                        return (
                            <div key={index}
                                style={{
                                    ...styles.message,
                                    ...(isUser ? styles.userMessage : styles.aiMessage),
                                }}>
                                <strong>{msg.sender}:</strong> {msg.message}
                            </div>
                        );
                    })}
                    {isLoading && (
                        <div style={{ ...styles.message, ...styles.aiMessage }}>
                            <strong>{aiRole}:</strong> 正在思考...
                        </div>
                    )}
                </div>

                {/* **输入区域和 @ 选单** */}
                <div style={styles.inputAreaWrapper}>
                    {showSuggestions && (
                        <div style={styles.suggestionList}>
                            {filteredMembers.map((member, index) => (
                                <div 
                                    key={index}
                                    style={styles.suggestionItem}
                                    onClick={() => handleSelectMember(member)}
                                >
                                    @{member} {member === aiRole ? '(AI)' : ''}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={styles.inputArea}>
                        <input
                            ref={inputRef}
                            type="text" 
                            value={inputMessage} 
                            onChange={handleInputChange} 
                            onKeyPress={handleKeyPress} 
                            placeholder="输入您的信息... (输入@即可选择成员，AI仅在被@时回复)" 
                            style={styles.input} 
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} style={styles.button} disabled={isLoading}>
                            {isLoading ? '发送中' : '发送'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}