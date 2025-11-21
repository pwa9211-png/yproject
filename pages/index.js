// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 定义页面布局样式
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    main: {
        padding: '2rem 0',
        flex: 1,
        display: 'flex',
        flexDirection: 'row', 
        alignItems: 'flex-start',
        width: '100%',
        maxWidth: '1200px', 
        position: 'relative', 
    },
    chatContainer: {
        flex: 1, 
        marginRight: '30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '900px',
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
        borderRadius: '8px',
        padding: '20px',
        height: '500px', // 稍微增高一点
        overflowY: 'scroll',
        marginBottom: '15px',
        backgroundColor: '#f9f9f9',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
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
        padding: '12px 16px',
        borderRadius: '12px',
        clear: 'both',
        overflow: 'hidden',
        maxWidth: '80%', // 限制消息宽度，更像气泡
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    userMessage: {
        float: 'right',
        backgroundColor: '#0070f3',
        color: 'white',
        marginLeft: 'auto',
        borderBottomRightRadius: '2px',
    },
    modelMessage: {
        float: 'left',
        backgroundColor: 'white', // AI 消息用白色背景
        color: '#333',
        marginRight: 'auto',
        border: '1px solid #e0e0e0',
        borderBottomLeftRadius: '2px',
    },
    inputArea: {
        display: 'flex',
        width: '100%',
        position: 'relative', 
    },
    textInput: {
        flexGrow: 1,
        padding: '12px',
        marginRight: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '1rem',
        outline: 'none',
    },
    sendButton: {
        padding: '10px 25px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
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
        padding: '30px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fefefe',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    memberListContainer: {
        width: '220px',
        border: '1px solid #ddd',
        padding: '15px',
        borderRadius: '8px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        marginTop: '105px', 
    },
    memberSelectMenu: {
        position: 'absolute',
        bottom: '55px', 
        left: '0',
        width: '200px',
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
    memberSelectItem: {
        padding: '10px',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
    },
};

// *** 新增：Markdown 渲染样式的自定义组件 ***
// 这会让 AI 的回复（列表、标题等）看起来更整齐
const markdownComponents = {
    // 段落
    p: ({node, ...props}) => <p style={{margin: '0 0 8px 0', lineHeight: '1.6'}} {...props} />,
    // 列表
    ul: ({node, ...props}) => <ul style={{paddingLeft: '20px', margin: '0 0 10px 0'}} {...props} />,
    ol: ({node, ...props}) => <ol style={{paddingLeft: '20px', margin: '0 0 10px 0'}} {...props} />,
    li: ({node, ...props}) => <li style={{marginBottom: '4px', lineHeight: '1.5'}} {...props} />,
    // 标题
    h1: ({node, ...props}) => <h3 style={{margin: '16px 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px'}} {...props} />,
    h2: ({node, ...props}) => <h4 style={{margin: '14px 0 8px 0', fontWeight: 'bold', color: '#0070f3'}} {...props} />,
    h3: ({node, ...props}) => <strong style={{display: 'block', margin: '12px 0 4px 0', fontSize: '1.05em'}} {...props} />,
    // 强调
    strong: ({node, ...props}) => <strong style={{fontWeight: '600', color: '#d32f2f'}} {...props} />,
    a: ({node, ...props}) => <a style={{color: '#0070f3', textDecoration: 'underline'}} {...props} />,
    table: ({node, ...props}) => <table style={{borderCollapse: 'collapse', width: '100%', margin: '10px 0'}} {...props} />,
    th: ({node, ...props}) => <th style={{border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2'}} {...props} />,
    td: ({node, ...props}) => <td style={{border: '1px solid #ddd', padding: '8px'}} {...props} />,
};

const AI_SENDER_NAME = '万能助理';

export default function Home() {
    const [room, setRoom] = useState('');
    const [sender, setSender] = useState('');
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [error, setError] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState([]); 
    const [showMemberSelect, setShowMemberSelect] = useState(false); 
    const [filteredMembers, setFilteredMembers] = useState([]); 
    const lastMessageCountRef = useRef(0); 
    
    const aiRole = `**${AI_SENDER_NAME}**`; 
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (chatHistory.length > lastMessageCountRef.current) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            lastMessageCountRef.current = chatHistory.length;
        }
    }, [chatHistory]);

    const fetchOnlineMembers = async (currentRoom, currentSender) => {
        if (!currentRoom) {
            setOnlineMembers([currentSender, AI_SENDER_NAME]);
            return;
        }
        let membersFromApi = [];
        try {
            const res = await fetch(`/api/online-status?room=${currentRoom}&sender=${currentSender}`);
            const data = await res.json();
            if (res.ok && data.members && Array.isArray(data.members)) {
                membersFromApi = data.members.map(m => m.sender);
            }
        } catch (err) {
            console.error("Failed to fetch online members:", err);
        }
        const uniqueMembers = new Set([currentSender, AI_SENDER_NAME, ...membersFromApi]);
        const finalMembers = Array.from(uniqueMembers);
        finalMembers.sort((a, b) => {
            if (a === currentSender) return -1;
            if (b === currentSender) return 1;
            return 0;
        });
        setOnlineMembers(finalMembers);
    };

    const fetchHistory = async (currentRoom) => {
        if (!currentRoom) return;
        try {
            const res = await fetch(`/api/history?room=${currentRoom}`);
            const data = await res.json();
            if (res.ok) {
                if (data.history) {
                    setChatHistory(data.history); 
                }
                setError(null);
            } else {
                console.error(`Fetch history failed: ${data.message}`);
            }
        } catch (err) {
            console.error(`Fetch history network error: ${err.message}`);
        }
    };

    useEffect(() => {
        if (!isLoggedIn) return;
        fetchOnlineMembers(room, sender);
        fetchHistory(room);
        const interval = setInterval(() => {
            fetchOnlineMembers(room, sender);
            fetchHistory(room); 
            fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username: sender }),
            }).catch(err => console.error("Heartbeat failed", err));
        }, 3000); 
        return () => clearInterval(interval);
    }, [isLoggedIn, room, sender]); 

    const handleLogin = (e) => {
        e.preventDefault();
        if (room && sender) {
            setIsLoggedIn(true);
            fetchHistory(room); 
            setError(`系统提示: 欢迎 ${sender} 加入房间 ${room}。AI 角色: ${aiRole}`);
        } else {
            setError('请输入房间号和您的称呼！');
        }
    };

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

    // *** 恢复导出对话功能 ***
    const handleExportChat = () => {
        if (chatHistory.length === 0) {
            alert('没有对话记录可导出。');
            return;
        }

        // 构建 HTML 内容
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>聊天记录 - 房间 ${room}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; background-color: #f9f9f9; }
        h1 { text-align: center; color: #333; border-bottom: 2px solid #0070f3; padding-bottom: 10px; }
        .info { text-align: center; color: #666; margin-bottom: 30px; font-size: 0.9em; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 10px; position: relative; clear: both; max-width: 80%; }
        .user { background-color: #e6f7ff; border: 1px solid #b3e0ff; margin-left: auto; text-align: left; }
        .model { background-color: #fff; border: 1px solid #ddd; margin-right: auto; text-align: left; }
        .sender { font-weight: bold; display: block; margin-bottom: 8px; color: #0052cc; }
        .timestamp { font-size: 0.8em; color: #999; float: right; margin-left: 10px; }
        .content { line-height: 1.6; white-space: pre-wrap; }
        /* 简单的 Markdown 样式模拟 */
        .content h1, .content h2, .content h3 { margin: 10px 0; font-size: 1.1em; }
        .content ul, .content ol { padding-left: 20px; margin: 5px 0; }
        .content strong { color: #d32f2f; }
    </style>
</head>
<body>
    <h1>多人 AI 智能聊天室 - 记录</h1>
    <div class="info">
        <p>房间号: ${room} | 导出时间: ${new Date().toLocaleString()}</p>
    </div>
    <div class="chat-log">
        ${chatHistory.map(msg => `
            <div class="message ${msg.role === 'user' ? 'user' : 'model'}">
                <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                <span class="sender">${msg.sender} (${msg.role === 'model' ? 'AI' : '用户'})</span>
                <div class="content">${msg.message}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat_history_room_${room}_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setMessage(value);
        let lastAtIndex = -1;
        for (let i = value.length - 1; i >= 0; i--) {
            if (value[i] === '@') {
                lastAtIndex = i;
                break;
            }
            if (value[i] === ' ') {
                lastAtIndex = -1; 
                break;
            }
        }
        if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
            const list = onlineMembers.filter(m => m !== sender);
            setFilteredMembers(list);
            setShowMemberSelect(true);
        } else if (lastAtIndex !== -1 && lastAtIndex < value.length - 1) {
            const query = value.substring(lastAtIndex + 1).toLowerCase();
            const list = onlineMembers.filter(m => m !== sender && m.toLowerCase().includes(query));
            setFilteredMembers(list);
            setShowMemberSelect(true);
        } else {
            setShowMemberSelect(false);
            setFilteredMembers([]);
        }
    };
    
    const selectMember = (member) => {
        const lastAtIndex = message.lastIndexOf('@');
        const newMessage = message.substring(0, lastAtIndex) + `@${member} `;
        setMessage(newMessage);
        setShowMemberSelect(false);
        inputRef.current.focus();
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || !isLoggedIn || isSending) return;
        const userMessage = { room, sender, message: message.trim(), role: 'user', timestamp: new Date() };
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
                    message: userMessage.message,
                    aiRole: AI_SENDER_NAME,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
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
                fetchHistory(room);
                setError(null);
            } else {
                setChatHistory(prev => prev.filter(msg => msg !== userMessage));
                setError(`发送失败，请重试。原因: ${data.message || 'API 请求失败: 服务器处理错误'}`);
            }
        } catch (err) {
            setChatHistory(prev => prev.filter(msg => msg !== userMessage));
            setError(`发送失败，请重试。原因: 网络连接错误或服务器无响应。`);
        } finally {
            setIsSending(false);
        }
    };

    if (!isLoggedIn) {
        return (
            <div style={simpleStyles.container}>
                <Head>
                    <title>多人 AI 智能聊天室 - 登录</title>
                </Head>
                <main style={simpleStyles.chatContainer}>
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

    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>多人 AI 智能聊天室</title>
            </Head>

            <div style={simpleStyles.main}>
                <div style={simpleStyles.chatContainer}>
                    <h1 style={simpleStyles.title}>
                        <span role="img" aria-label="robot">🤖</span>
                        <span role="img" aria-label="person">🧑‍💻</span> 
                        多人 AI 智能聊天室
                    </h1>

                    <div style={simpleStyles.chatHeader}>
                        <span>当前房间: **{room}** | AI 角色: {aiRole} ({sender})</span>
                        <div>
                            <button onClick={handleExportChat} style={{ ...simpleStyles.sendButton, backgroundColor: '#6c757d', marginRight: '10px' }}>导出对话 (HTML)</button>
                            <button onClick={clearHistory} style={{ ...simpleStyles.sendButton, backgroundColor: '#dc3545' }}>清空对话</button>
                        </div>
                    </div>

                    {error && <div style={simpleStyles.errorBox}>{error}</div>}

                    <div style={simpleStyles.chatArea}>
                        {chatHistory && chatHistory.map((msg, index) => ( 
                            <div key={index} style={{
                                ...simpleStyles.messageContainer,
                                ...(msg.role === 'user' ? simpleStyles.userMessage : simpleStyles.modelMessage),
                            }}>
                                <strong>{msg.sender}:</strong>
                                <div style={{ wordWrap: 'break-word', marginTop: '5px' }}>
                                    <ReactMarkdown 
                                        children={msg.message} 
                                        remarkPlugins={[remarkGfm]} 
                                        components={markdownComponents} // 应用自定义 Markdown 样式
                                    />
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    
                    <form onSubmit={sendMessage} style={simpleStyles.inputArea}>
                        {showMemberSelect && filteredMembers.length > 0 && (
                            <div style={simpleStyles.memberSelectMenu}>
                                {filteredMembers.map((member, index) => (
                                    <div 
                                        key={index} 
                                        style={simpleStyles.memberSelectItem}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = simpleStyles.memberSelectItemHover.backgroundColor}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                        onClick={() => selectMember(member)}
                                    >
                                        {member} {member === AI_SENDER_NAME && '(AI)'}
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={`输入您的信息... (输入@ 可选择成员)`}
                            value={message}
                            onChange={handleInputChange} 
                            disabled={isSending}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                            {isSending ? '发送中...' : '发送'}
                        </button>
                    </form>

                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                        * AI 仅在被 @ 时回复 (例如: @{AI_SENDER_NAME} 你好)
                        <br/>
                        * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                    </p>
                </div>

                <div style={simpleStyles.memberListContainer}>
                    <strong>在线成员</strong>
                    <hr/>
                    {onlineMembers.length > 0 ? (
                        onlineMembers.map((member, index) => (
                            <div key={index} style={{ marginBottom: '5px', color: member === sender ? '#0070f3' : '#333' }}>
                                {member} {member === sender ? '(你)' : member === AI_SENDER_NAME ? '(AI)' : ''}
                            </div>
                        ))
                    ) : (
                        <div style={{ color: '#aaa', fontSize: '0.9rem' }}>正在加载或无其他成员...</div>
                    )}
                </div>
            </div>
        </div>
    );
}