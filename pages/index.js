import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown'; // 导入 Markdown 渲染器
import remarkGfm from 'remark-gfm';         // 导入对表格、删除线等扩展格式的支持

// --- 常量 ---
const aiRole = "环球智囊";
const HISTORY_POLLING_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 10000;
const OFFLINE_THRESHOLD = 30000;

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
        width: 'calc(100% - 75px)', 
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
    },
    // 新增：Markdown 渲染器内联样式 (重要：覆盖默认的H1等样式，防止破坏布局)
    markdownComponents: {
        h1: ({ node, ...props }) => <h3 style={{ margin: '8px 0', borderBottom: '1px solid #ccc' }} {...props} />,
        h2: ({ node, ...props }) => <h4 style={{ margin: '6px 0', color: '#007bff' }} {...props} />,
        h3: ({ node, ...props }) => <h5 style={{ margin: '4px 0', color: '#28a745' }} {...props} />,
        ul: ({ node, ...props }) => <ul style={{ paddingLeft: '20px', margin: '5px 0' }} {...props} />,
        ol: ({ node, ...props }) => <ol style={{ paddingLeft: '20px', margin: '5px 0' }} {...props} />,
        p: ({ node, ...props }) => <p style={{ margin: '4px 0', lineHeight: '1.4' }} {...props} />,
        strong: ({ node, ...props }) => <strong style={{ fontWeight: 'bold' }} {...props} />,
        a: ({ node, ...props }) => <a style={{ color: '#007bff' }} {...props} />,
    }
};

// 主应用组件 (登录逻辑保持不变)
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
    
    const sendHeartbeat = async () => {
        try {
            await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username }),
            });
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    };

    const loadHistory = async (isManual = false) => {
        try {
            // 1. 获取聊天历史
            const historyRes = await fetch(`/api/history?room=${room}`);
            if (!historyRes.ok) throw new Error('无法获取历史记录。');
            const historyData = await historyRes.json();
            
            // 2. 获取实时在线状态
            const statusRes = await fetch(`/api/online-status?room=${room}`);
            if (!statusRes.ok) throw new Error('无法获取在线状态。');
            const statusData = await statusRes.json();
            
            const now = Date.now();
            
            // 根据心跳过滤出在线用户
            const activeUsers = statusData.filter(user => 
                (now - new Date(user.lastActive).getTime()) < OFFLINE_THRESHOLD
            ).map(user => user.username);
            
            // 将 AI 角色加入列表 (AI 永远在线)
            if (!activeUsers.includes(aiRole)) {
                 activeUsers.push(aiRole); 
            }
            
            setOnlineMembers(activeUsers);
            
            // 3. 更新聊天消息
            const newMessages = [
                { role: 'system', message: `欢迎 ${username} 加入房间 ${room}。AI 角色: **${aiRole}**。` },
                ...historyData.messages,
            ];

            if (newMessages.length !== lastMessageCountRef.current || isManual) {
                 setMessages(newMessages);
                 lastMessageCountRef.current = newMessages.length;
            }

        } catch (error) {
            console.error('Error loading data:', error);
            if (lastMessageCountRef.current === 0) {
                 setMessages([
                    { role: 'system', message: `无法加载聊天历史/在线状态，请检查后端配置和网络连接。错误信息: ${error.message}` },
                    { role: 'system', message: `欢迎 ${username} 加入房间 ${room}。我是 ${aiRole}，很高兴为您规划旅行！` },
                ]);
            }
        }
    };

    // 心跳和轮询启动
    useEffect(() => {
        sendHeartbeat(); 
        
        const heartbeatIntervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        
        loadHistory(); 
        const historyIntervalId = setInterval(() => {
            loadHistory();
        }, HISTORY_POLLING_INTERVAL);

        return () => {
            clearInterval(heartbeatIntervalId);
            clearInterval(historyIntervalId);
        }
    }, [room, username, aiRole]); 
    
    // 自动滚动到底部 (保持不变)
    useEffect(() => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    }, [messages]);
    
    // 输入框和发送逻辑 (保持不变)
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputMessage(value);

        const lastChar = value.slice(-1);
        if (lastChar === '@') {
            setShowSuggestions(true);
        } else if (showSuggestions && !value.includes('@')) {
            setShowSuggestions(false);
        }
    };
    
    const handleSelectMember = (member) => {
        const newValue = inputMessage.replace(/@$/, '') + `@${member} `; 
        setInputMessage(newValue);
        setShowSuggestions(false);
        inputRef.current.focus();
    };

    const filteredMembers = onlineMembers.filter(member => member !== username);

    const handleSend = async () => {
        if (!inputMessage.trim() || isLoading) return;
        setShowSuggestions(false);

        const userMsg = { role: 'user', message: inputMessage.trim(), sender: username };
        setMessages(prev => [...prev, userMsg]); 
        setInputMessage('');
        setIsLoading(true);
        
        await sendHeartbeat();

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
    
    // 导出对话记录处理函数 (HTML格式) - 保持不变
    const handleExportChat = () => {
        // ... (HTML 导出逻辑保持不变，用于下载文件) ...
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
            
            // 确保导出的 HTML 也使用 Markdown 格式渲染，以保持一致性
            // 注意：这里我们只导出消息文本，不包含 ReactMarkdown 组件
            const messageContent = msg.message.replace(/\n/g, '<br>');
            
            return `
                <div style="${messageStyle}">
                    <strong>${msg.sender}</strong> (${date}):<br>
                    ${messageContent}
                </div>
            `;
        }).join('\n');

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
                    /* 导出文件中的Markdown样式也可以在这里定制 */
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
                    <h4>在线成员 (心跳检测)</h4>
                    {onlineMembers.filter(member => member !== aiRole && member !== username).map(member => (
                         <p key={member} style={{ ...styles.userItem, color: '#000000' }}>
                            {member}
                         </p>
                    ))}
                    {/* 当前用户永远显示为在线 */}
                    <p style={{ ...styles.userItem, color: '#007bff' }}>{username} (你)</p>
                    {/* AI 始终显示 */}
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
                                <strong>{msg.sender}:</strong> 
                                {/* 核心变化：使用 ReactMarkdown 渲染消息内容 */}
                                <div style={{ 
                                    color: isUser ? 'white' : '#333', // 确保文本颜色正确
                                    textAlign: 'left' // 强制 Markdown 内容左对齐
                                }}>
                                    <ReactMarkdown
                                        children={msg.message}
                                        remarkPlugins={[remarkGfm]}
                                        components={styles.markdownComponents} // 使用定制的组件样式
                                    />
                                </div>
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