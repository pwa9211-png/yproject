import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// --- 样式定义 ---
const styles = {
    container: { maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
    header: { textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' },
    chatWindow: { height: '400px', border: '1px solid #ccc', borderRadius: '8px', padding: '10px', overflowY: 'scroll', marginBottom: '10px', backgroundColor: '#f9f9f9' },
    message: { marginBottom: '10px', padding: '8px', borderRadius: '15px', maxWidth: '70%' },
    userMessage: { backgroundColor: '#007bff', color: 'white', marginLeft: 'auto', textAlign: 'right' },
    aiMessage: { backgroundColor: '#e9ecef', color: '#333', textAlign: 'left' },
    systemMessage: { textAlign: 'center', color: '#dc3545', marginBottom: '10px' },
    inputArea: { display: 'flex' },
    input: { flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px 0 0 4px' },
    button: { padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' },
    userList: { position: 'fixed', top: '20px', right: '20px', width: '200px', border: '1px solid #ccc', padding: '10px', borderRadius: '8px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    userItem: { marginBottom: '5px', fontWeight: 'bold', color: '#007bff' },
    loginForm: { display: 'flex', flexDirection: 'column', gap: '15px', padding: '40px', border: '1px solid #eee', borderRadius: '10px', maxWidth: '400px', margin: '100px auto' }
};
// --- 组件定义 ---

const aiRole = "环球智囊"; // 固定 AI 的角色名称

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
                <h1 style={styles.header}>AI 旅行规划聊天室 - 登录</h1>
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

    // 登录成功后渲染 ChatRoom 组件
    return <ChatRoom username={username} room={room} aiRole={aiRole} />;
}

// ChatRoom 组件 (从原 index.js 提取)
function ChatRoom({ username, room, aiRole }) {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatWindowRef = useRef(null);

    // 自动滚动到底部
    useEffect(() => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    }, [messages]);

    // 初始化：加载历史消息
    useEffect(() => {
        async function loadHistory() {
            try {
                const res = await fetch(`/api/history?room=${room}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ message: '网络连接错误或服务器失败。' }));
                    throw new Error(errorData.message || '网络连接错误或服务器失败。');
                }
                const data = await res.json();
                
                // 确保 system message 始终在最前面
                setMessages([
                    { role: 'system', message: `欢迎 ${username} 加入房间 ${room}。AI 角色: **${aiRole}**。` },
                    ...data.messages,
                ]);

            } catch (error) {
                console.error('Error loading history:', error);
                setMessages([
                    { role: 'system', message: `无法加载聊天历史，请检查后端配置和网络连接。错误信息: ${error.message}` },
                    { role: 'system', message: `欢迎 ${username} 加入房间 ${room}。我是 ${aiRole}，很高兴为您规划旅行！` },
                ]);
            }
        }
        loadHistory();
    }, [room, username, aiRole]); // 依赖 room, username, aiRole

    // 处理消息发送
    const handleSend = async () => {
        if (!inputMessage.trim() || isLoading) return;

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
                    message: inputMessage.trim(),
                    aiRole: aiRole,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: '未知服务器错误' }));
                throw new Error(errorData.message || `API 请求失败: ${res.status}`);
            }

            const data = await res.json();
            const aiMsg = { role: 'assistant', message: data.aiResponse, sender: aiRole };
            setMessages(prev => [...prev, aiMsg]);

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

    return (
        <>
            <Head><title>双人 AI 旅行规划聊天室</title></Head>
            <div style={styles.container}>
                <header style={styles.header}>
                    <h1>
                        <span role="img" aria-label="user">👤</span>
                        <span role="img" aria-label="ai">🤖</span>
                        {" "}双人 AI 旅行规划聊天室
                    </h1>
                    <p>当前房间: **{room}** | AI 角色: **{aiRole}** ({username})</p>
                </header>

                <div style={styles.userList}>
                    <h4>在线成员</h4>
                    <p style={styles.userItem}>{username} (你)</p>
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

                <div style={styles.inputArea}>
                    <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress} placeholder="输入您的信息..." style={styles.input} disabled={isLoading}
                    />
                    <button onClick={handleSend} style={styles.button} disabled={isLoading}>
                        {isLoading ? '发送中' : '发送'}
                    </button>
                </div>
            </div>
        </>
    );
}