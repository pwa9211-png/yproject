// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
// -------------------

const simpleStyles = {
    // ... (所有样式代码保持不变，为节省篇幅在此省略)
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
    title: {
        margin: '0',
        lineHeight: 1.15,
        fontSize: '2.5rem',
        textAlign: 'center',
        marginBottom: '25px',
    },
    // ... (其余 simpleStyles 保持不变)
    chatArea: {
        width: '100%',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '20px',
        height: '500px',
        overflowY: 'scroll',
        marginBottom: '15px',
        backgroundColor: '#f9f9f9',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
        scrollBehavior: 'auto',
    },
    // ...
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
    // ... (其余 simpleStyles 保持不变)
};

const markdownComponents = {
    // ... (markdownComponents 保持不变)
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
    
    const aiRole = `**${AI_SENDER_NAME}**`; 
    
    const chatAreaRef = useRef(null); 
    const inputRef = useRef(null);

    useEffect(() => {
        if (chatAreaRef.current) {
            const timer = setTimeout(() => {
                chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [chatHistory]);

    // 🚨 修正 fetchOnlineMembers: 增加 sender 参数
    const fetchOnlineMembers = async (currentRoom, currentSender) => {
        if (!currentRoom) {
            setOnlineMembers([currentSender, AI_SENDER_NAME]);
            return;
        }
        let membersFromApi = [];
        try {
            // 在请求中包含 sender，以便后端进行权限检查
            const res = await fetch(`/api/online-status?room=${currentRoom}&sender=${currentSender}`); 
            const data = await res.json();
            if (res.ok && data.members && Array.isArray(data.members)) {
                membersFromApi = data.members.map(m => m.sender);
            } else if (res.status === 403) {
                // 如果后端返回 403，则仅显示自己和 AI，并给出提示
                console.warn(`房间 ${currentRoom} 在线成员获取失败 (403 Forbidden)。`);
                setError(`系统提示: 房间 ${currentRoom} 是限制房间，您无权获取在线成员列表。`);
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

    // 🚨 修正 fetchHistory: 增加 sender 参数
    const fetchHistory = async (currentRoom, currentSender) => {
        if (!currentRoom) return;
        try {
            // 在请求中包含 sender，以便后端进行权限检查
            const res = await fetch(`/api/history?room=${currentRoom}&sender=${currentSender}`); 
            const data = await res.json();
            if (res.ok) {
                if (data.history) {
                    setChatHistory(data.history); 
                }
                setError(null);
            } else if (res.status === 403) {
                 // 如果后端返回 403，则清空历史并给出错误提示
                 setChatHistory([]);
                 setError(data.message);
            } else {
                console.error(`Fetch history failed: ${data.message}`);
            }
        } catch (err) {
            console.error(`Fetch history network error: ${err.message}`);
        }
    };

    useEffect(() => {
        if (!isLoggedIn) return;
        // 🚨 传入 sender 参数
        fetchOnlineMembers(room, sender); 
        fetchHistory(room, sender); 
        const interval = setInterval(() => {
            // 🚨 传入 sender 参数
            fetchOnlineMembers(room, sender); 
            fetchHistory(room, sender); 
            fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username: sender }),
            }).catch(err => console.error("Heartbeat failed", err));
        }, 3000); 
        return () => clearInterval(interval);
    }, [isLoggedIn, room, sender]); 

    // 🚨 修正 handleLogin: 添加前端权限检查
    const handleLogin = (e) => {
        e.preventDefault();
        if (room && sender) {
            // --- 前端权限检查 START ---
            if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
                setError(`对不起，房间 ${RESTRICTED_ROOM} 是限制房间。只有 ${ALLOWED_USERS.join(' 和 ')} 可以进入。`);
                return; // 阻止登录
            }
            // --- 前端权限检查 END ---

            setIsLoggedIn(true);
            // 🚨 在登录时调用 history 需要传入 sender
            fetchHistory(room, sender); 
            setError(`系统提示: 欢迎 ${sender} 加入房间 ${room}。AI 角色: ${aiRole}`);
        } else {
            setError('请输入房间号和您的称呼！');
        }
    };

    // ... (其余函数 clearHistory, handleExportChat, handleInputChange, selectMember, sendMessage 保持不变)
    const clearHistory = async () => {
        // ... (保持不变)
    };

    const handleExportChat = () => {
        // ... (保持不变)
    };

    const handleInputChange = (e) => {
        // ... (保持不变)
    };
    
    const selectMember = (member) => {
        // ... (保持不变)
    };

    const sendMessage = async (e) => {
        // ... (保持不变)
    };

    if (!isLoggedIn) {
        return (
            <div style={simpleStyles.container}>
                <Head>
                    <title>多人 AI 智能聊天室 - 登录</title>
                </Head>
                <main style={{...simpleStyles.chatContainer, margin: 'auto'}}>
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
                            placeholder="输入您的称呼 (例如: Bear)" 
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
        // ... (其余聊天界面渲染代码保持不变)
        <div style={simpleStyles.container}>
            <Head>
                <title>多人 AI 智能聊天室</title>
            </Head>

            {/* 🚨 应用响应式类名 */}
            <div className="main-layout" style={{ 
                padding: '2rem 0', 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'row', // 默认是 row
                alignItems: 'flex-start',
                width: '100%',
                maxWidth: '1200px', 
                position: 'relative', 
            }}>
                {/* 🚨 应用响应式类名 */}
                <div className="chat-container" style={{ 
                    flex: 1, 
                    marginRight: '30px', // 默认右侧间距
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    maxWidth: '900px',
                }}>
                    {/* 🚨 应用响应式类名 */}
                    <h1 style={simpleStyles.title} className="chat-title">
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

                    {/* 🚨 应用 ref 和响应式类名 */}
                    <div style={simpleStyles.chatArea} ref={chatAreaRef} className="chat-area">
                        {chatHistory && chatHistory.map((msg, index) => ( 
                            <div key={index} style={{
                                ...simpleStyles.messageContainer,
                                ...(msg.role === 'user' ? simpleStyles.userMessage : simpleStyles.modelMessage),
                            }}
                            className="message-container" // 🚨 应用响应式类名
                            >
                                <strong>{msg.sender}:</strong>
                                <div style={{ wordWrap: 'break-word', marginTop: '5px' }}>
                                    <ReactMarkdown 
                                        children={msg.message} 
                                        remarkPlugins={[remarkGfm]} 
                                        components={markdownComponents} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {/* 🚨 应用响应式类名 */}
                    <form onSubmit={sendMessage} style={simpleStyles.inputArea} className="input-area">
                        {showMemberSelect && filteredMembers.length > 0 && (
                           // ... (memberSelectMenu 保持不变)
                           <div style={simpleStyles.memberSelectMenu}>
                                {filteredMembers.map((member, index) => (
                                    <div 
                                        key={index} 
                                        style={simpleStyles.memberSelectItem}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
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

                {/* 🚨 应用响应式类名 */}
                <div style={simpleStyles.memberListContainer} className="member-list-container">
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