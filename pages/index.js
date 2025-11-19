// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 定义一个简单的CSS对象来代替Home.module.css，以提供基本样式
const simpleStyles = {
    container: {
        minHeight: '100vh',
        padding: '0 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        color: '#333',
    },
    main: {
        padding: '2rem 0',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '900px', // 限制最大宽度
    },
    title: {
        margin: '0',
        lineHeight: 1.15,
        fontSize: '2.5rem',
        textAlign: 'center',
        marginBottom: '25px',
    },
    chatArea: {
        width: '100%',
        border: '1px solid #ccc',
        borderRadius: '5px',
        padding: '10px',
        height: '400px',
        overflowY: 'scroll',
        marginBottom: '10px',
        backgroundColor: '#f9f9f9',
    },
    chatHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #ddd',
        width: '100%',
        fontSize: '1rem',
    },
    messageContainer: {
        marginBottom: '15px',
        padding: '10px',
        borderRadius: '8px',
        clear: 'both',
        overflow: 'hidden',
    },
    userMessage: {
        float: 'right',
        backgroundColor: '#0070f3',
        color: 'white',
        maxWidth: '70%',
        marginLeft: 'auto',
    },
    modelMessage: {
        float: 'left',
        backgroundColor: '#eee',
        color: '#333',
        maxWidth: '70%',
        marginRight: 'auto',
    },
    inputArea: {
        display: 'flex',
        width: '100%',
    },
    textInput: {
        flexGrow: 1,
        padding: '10px',
        marginRight: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '1rem',
    },
    sendButton: {
        padding: '10px 20px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1rem',
        whiteSpace: 'nowrap',
    },
    errorBox: {
        padding: '10px',
        backgroundColor: '#ffdddd',
        color: '#cc0000',
        border: '1px solid #cc0000',
        borderRadius: '5px',
        marginBottom: '10px',
        width: '100%',
    },
    loginForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        width: '300px',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fefefe',
    }
};


export default function Home() {
    const [room, setRoom] = useState('');
    const [sender, setSender] = useState('');
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [error, setError] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    // AI 角色设定为新的通用名称
    const aiRole = '**万能助理**'; 
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);

    // 加载历史消息的逻辑
    const fetchHistory = async (currentRoom) => {
        if (!currentRoom) return;
        try {
            const res = await fetch(`/api/history?room=${currentRoom}`);
            const data = await res.json();
            if (res.ok) {
                // 确保 data.history 至少是一个空数组
                setChatHistory(data.history || []); 
                setError(null);
            } else {
                setChatHistory([]); // 失败时清空
                setError(`无法加载聊天历史，请检查后端配置和网络连接。错误信息: ${data.message || '未知错误'}`);
            }
        } catch (err) {
            setChatHistory([]); // 失败时清空
            setError(`无法加载聊天历史，请检查后端配置和网络连接。错误信息: ${err.message}`);
        }
    };

    // 登录/加入房间逻辑
    const handleLogin = (e) => {
        e.preventDefault();
        if (room && sender) {
            setIsLoggedIn(true);
            // 在用户加入后，立即尝试加载历史
            fetchHistory(room); 
            setError(`系统提示: 欢迎 ${sender} 加入房间 ${room}。AI 角色: ${aiRole}`);
        } else {
            setError('请输入房间号和您的称呼！');
        }
    };

    // 清空历史逻辑
    const clearHistory = async () => {
        if (!room) return;
        if (!window.confirm("确定要清空当前房间的所有聊天历史吗？")) return;

        try {
            const res = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });
            const data = await res.json();
            if (res.ok) {
                setChatHistory([]);
                setError(`系统提示: 房间 ${room} 聊天历史已清空。`);
            } else {
                setError(`清空历史失败: ${data.message}`);
            }
        } catch (err) {
            setError(`清空历史失败: ${err.message}`);
        }
    };

    // 发送消息逻辑
    const sendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || !isLoggedIn || isSending) return;

        const userMessage = { room, sender, message: message.trim(), role: 'user', timestamp: new Date() };
        
        // 乐观更新 UI
        setChatHistory(prev => [...prev, userMessage]);
        setMessage('');
        setIsSending(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room,
                    sender,
                    message: userMessage.message, // 使用 userMessage.message 以确保是发送的消息
                    aiRole: aiRole.replace(/\*\*/g, ''), // 移除 **
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // 如果 AI 回复存在，则添加到历史记录
                if (data.ai_reply && data.ai_reply !== 'AI 未被 @，不回复。') {
                    const aiMessage = { 
                        room, 
                        sender: aiRole, 
                        message: data.ai_reply, 
                        role: 'model', 
                        timestamp: new Date() 
                    };
                    setChatHistory(prev => [...prev, aiMessage]);
                }
                setError(null);
            } else {
                // API 调用失败，显示错误并移除乐观更新的用户消息
                setChatHistory(prev => prev.filter(msg => msg !== userMessage));
                setError(`发送失败，请重试。原因: ${data.message || 'API 请求失败: 服务器处理错误'}`);
            }

        } catch (err) {
            // 网络错误或解析错误
            setChatHistory(prev => prev.filter(msg => msg !== userMessage));
            setError(`发送失败，请重试。原因: 网络连接错误或服务器无响应。`);
        } finally {
            setIsSending(false);
        }
    };


    // 登录界面
    if (!isLoggedIn) {
        return (
            <div style={simpleStyles.container}>
                <Head>
                    <title>多人 AI 智能聊天室 - 登录</title>
                </Head>
                <main style={simpleStyles.main}>
                    <h1 style={simpleStyles.title}>
                        <span role="img" aria-label="robot">🤖</span>
                        <span role="img" aria-label="person">🧑‍💻</span> 
                        多人 AI 智能聊天室
                    </h1>
                    {error && <div style={simpleStyles.errorBox}>{error}</div>}
                    <form onSubmit={handleLogin} style={simpleStyles.loginForm}>
                        <input
                            type="text"
                            placeholder="输入房间号 (例如: 123)"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            required
                            style={simpleStyles.textInput}
                        />
                        <input
                            type="text"
                            placeholder="输入您的称呼 (例如: shane)"
                            value={sender}
                            onChange={(e) => setSender(e.target.value)}
                            required
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" style={simpleStyles.sendButton}>
                            加入聊天
                        </button>
                    </form>
                </main>
            </div>
        );
    }

    // 主聊天界面
    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>多人 AI 智能聊天室</title>
            </Head>

            <main style={simpleStyles.main}>
                <h1 style={simpleStyles.title}>
                    <span role="img" aria-label="robot">🤖</span>
                    <span role="img" aria-label="person">🧑‍💻</span> 
                    多人 AI 智能聊天室
                </h1>

                <div style={simpleStyles.chatHeader}>
                    <span>当前房间: **{room}** | AI 角色: {aiRole} ({sender})</span>
                    <div>
                        {/* 导出对话功能未实现，仅为占位符 */}
                        <button onClick={() => alert("导出对话功能待实现")} style={{ ...simpleStyles.sendButton, backgroundColor: '#6c757d', marginRight: '10px' }}>导出对话 (HTML)</button>
                        <button onClick={clearHistory} style={{ ...simpleStyles.sendButton, backgroundColor: '#dc3545' }}>清空对话</button>
                    </div>
                </div>

                {error && <div style={simpleStyles.errorBox}>{error}</div>}

                <div style={simpleStyles.chatArea}>
                    {/* 🚨 核心修复：添加 chatHistory && 检查，防止 map() 在 undefined 上调用 */}
                    {chatHistory && chatHistory.map((msg, index) => ( 
                        <div key={index} style={{
                            ...simpleStyles.messageContainer,
                            ...(msg.role === 'user' ? simpleStyles.userMessage : simpleStyles.modelMessage),
                        }}>
                            <strong>{msg.sender}:</strong>
                            <div style={{ wordWrap: 'break-word', marginTop: '5px' }}>
                                {/* 重新使用 ReactMarkdown 渲染内容 */}
                                <ReactMarkdown children={msg.message} remarkPlugins={[remarkGfm]} />
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                
                <form onSubmit={sendMessage} style={simpleStyles.inputArea}>
                    <input
                        type="text"
                        placeholder={`输入您的信息... (输入@${aiRole.replace(/\*\*/g, '')} 可呼叫AI)`}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={isSending}
                        style={simpleStyles.textInput}
                    />
                    <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                        {isSending ? '发送中...' : '发送'}
                    </button>
                </form>

                <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                    * AI 仅在被 @ 时回复 (例如: @{aiRole.replace(/\*\*/g, '')} 你好)
                    <br/>
                    * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                </p>
            </main>
        </div>
    );
}