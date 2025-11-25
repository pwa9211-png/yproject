// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // AI 的昵称
// -------------------

// 定义一个简单的CSS对象来代替Home.module.css，以提供基本样式
// ⚠️ 注意：这只是一个示例样式，请确保它与您项目的 global.css 配合使用
const simpleStyles = {
    // 基础布局
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
    header: {
        width: '100%',
        maxWidth: '1200px',
        padding: '1rem 0',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        margin: '0',
        lineHeight: 1.15,
        fontSize: '2.5rem',
        textAlign: 'center',
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
        flex: 3,
        marginRight: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    },
    chatWindow: {
        height: '500px', // 设定聊天窗口固定高度
        overflowY: 'scroll', // 允许滚动
        padding: '10px',
        backgroundColor: '#f9f9f9',
    },
    memberListContainer: {
        flex: 1,
        padding: '15px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        maxHeight: '500px',
        overflowY: 'auto',
    },
    inputForm: {
        display: 'flex',
        padding: '10px',
        borderTop: '1px solid #eee',
        backgroundColor: 'white',
    },
    textInput: {
        flex: 1,
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        marginRight: '10px',
    },
    sendButton: {
        padding: '10px 15px',
        border: 'none',
        borderRadius: '5px',
        backgroundColor: '#0070f3',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
    },
    clearButton: {
        marginLeft: '15px',
        padding: '5px 10px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#f0f0f0',
        color: '#d9534f',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    messageContainer: (isUser) => ({
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
    }),
    messageBubble: (isUser, isAI) => ({
        maxWidth: '70%',
        padding: '8px 12px',
        borderRadius: '15px',
        backgroundColor: isUser ? '#0070f3' : isAI ? '#e6f7ff' : '#eee',
        color: isUser ? 'white' : '#333',
        wordBreak: 'break-word',
    }),
    senderInfo: {
        fontSize: '0.75rem',
        color: '#999',
        textAlign: 'right',
        marginBottom: '2px',
    },
    joinForm: {
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        width: '400px',
        display: 'flex',
        flexDirection: 'column',
    },
    input: {
        padding: '10px',
        marginBottom: '10px',
        borderRadius: '5px',
        border: '1px solid #ccc',
    },
    error: {
        color: '#d9534f',
        marginTop: '10px',
        textAlign: 'center',
    }
};

const markdownComponents = {
    // 基础 HTML 标签的样式
    p: ({ node, ...props }) => <p style={{ margin: '0 0 5px 0' }} {...props} />,
    br: ({ node, ...props }) => <br {...props} />,
    // 表格样式
    table: ({ node, ...props }) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '10px 0' }} {...props} />,
    th: ({ node, ...props }) => <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' }} {...props} />,
    td: ({ node, ...props }) => <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }} {...props} />,
};


export default function ChatRoom() {
    // --- 状态和 Refs (已新增滚动逻辑) ---
    const [sender, setSender] = useState('');
    const [room, setRoom] = useState('');
    const [aiRole, setAiRole] = useState('万能助理');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [onlineMembers, setOnlineMembers] = useState([AI_SENDER_NAME]);
    const [isInitialized, setIsInitialized] = useState(false);
    
    // ⭐️ 新增：Ref 引用聊天窗口容器
    const chatContentRef = useRef(null);
    // ⭐️ 新增：状态追踪用户是否位于底部
    const [isUserAtBottom, setIsUserAtBottom] = useState(true); 

    // 用于首次加载和权限检查
    const [isJoined, setIsJoined] = useState(false); 
    const [joinError, setJoinError] = useState(''); 

    // --- 滚动逻辑函数 ---

    // 滚动函数：执行滚动操作
    const scrollToBottom = () => {
        if (chatContentRef.current) {
            chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
        }
    };

    // 检查滚动条位置的函数：更新 isUserAtBottom 状态
    const handleScroll = () => {
        if (chatContentRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContentRef.current;
            // 判断用户是否接近底部 (距离底部 100px 算作在底部)
            const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
            
            // 只有当状态发生变化时才更新
            if (isUserAtBottom !== isNearBottom) {
                 setIsUserAtBottom(isNearBottom);
            }
        }
    };

    // --- API 交互函数 ---
    
    // 1. 获取消息历史
    const fetchHistory = async (currentRoom, currentSender) => {
        if (!currentRoom || !currentSender) return;

        try {
            const response = await fetch(`/api/history?room=${currentRoom}&sender=${currentSender}`);
            const data = await response.json();
            
            if (response.status === 403) {
                setJoinError(data.message || '权限错误，无法获取历史记录。');
                return false;
            }
            
            if (data.success) {
                setMessages(data.history || []);
                // 首次加载成功，设置初始化标志
                if (!isInitialized) {
                    setIsInitialized(true);
                }
                return true;
            } else {
                console.error("Failed to fetch history:", data.message);
                setJoinError(data.message || '获取历史记录失败。');
                return false;
            }
        } catch (error) {
            console.error('API Error:', error);
            setJoinError('连接 API 失败。');
            return false;
        }
    };

    // 2. 发送心跳信号
    const sendHeartbeat = async (currentRoom, currentSender) => {
        if (!currentRoom || !currentSender) return;
        try {
            await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: currentRoom, username: currentSender }),
            });
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    };

    // 3. 获取在线成员
    const fetchOnlineMembers = async (currentRoom, currentSender) => {
        if (!currentRoom || !currentSender) return;
        try {
            const response = await fetch(`/api/online-status?room=${currentRoom}&sender=${currentSender}`);
            const data = await response.json();
            
            if (response.status === 403) {
                setJoinError(data.message || '权限错误，无法获取在线成员。');
                return;
            }

            if (data.success) {
                // 确保 AI 助理始终在列表内
                const uniqueMembers = new Set([...(data.members || []), AI_SENDER_NAME]);
                setOnlineMembers(Array.from(uniqueMembers));
            }
        } catch (error) {
            console.error('Failed to fetch online status:', error);
        }
    };
    
    // --- Hook: 自动滚动和初始化 ---
    useEffect(() => {
        // ⭐️ 关键修改：只有在 isUserAtBottom 为 true 时才滚动
        if (isUserAtBottom && chatContentRef.current) {
            scrollToBottom();
        }
    }, [messages, isUserAtBottom]); // 当消息更新或用户滚动状态变化时检查

    // --- Hook: 加入逻辑 (只在首次渲染时运行) ---
    useEffect(() => {
        // 尝试从 sessionStorage 获取信息，自动加入
        const savedSender = sessionStorage.getItem('sender');
        const savedRoom = sessionStorage.getItem('room');
        const savedAiRole = sessionStorage.getItem('aiRole') || '万能助理';

        if (savedSender && savedRoom) {
            setSender(savedSender);
            setRoom(savedRoom);
            setAiRole(savedAiRole);
            
            const joinSuccess = fetchHistory(savedRoom, savedSender);
            if (joinSuccess) {
                setIsJoined(true);
            }
        }
    }, []);

    // --- Hook: 轮询逻辑 (获取新消息、心跳、在线成员) ---
    useEffect(() => {
        if (!isJoined) return;

        // 立即发送心跳并获取在线成员
        sendHeartbeat(room, sender);
        fetchOnlineMembers(room, sender);
        
        // 设置轮询定时器
        const historyInterval = setInterval(() => {
            fetchHistory(room, sender);
        }, 2000); // 每 2 秒检查一次新消息

        const heartbeatInterval = setInterval(() => {
            sendHeartbeat(room, sender);
            fetchOnlineMembers(room, sender);
        }, 10000); // 每 10 秒发送一次心跳/更新成员列表

        // 清理函数：组件卸载时清除定时器
        return () => {
            clearInterval(historyInterval);
            clearInterval(heartbeatInterval);
        };
    }, [isJoined, room, sender]);


    // --- 事件处理函数 ---

    // 1. 处理输入框变化
    const handleInputChange = (e) => {
        setInputMessage(e.target.value);
    };
    
    // 2. 处理加入聊天室
    const handleJoin = async () => {
        if (!sender.trim() || !room.trim()) {
            setJoinError('昵称和房间号不能为空。');
            return;
        }

        const success = await fetchHistory(room, sender);
        if (success) {
            setIsJoined(true);
            setJoinError('');
            sessionStorage.setItem('sender', sender);
            sessionStorage.setItem('room', room);
            sessionStorage.setItem('aiRole', aiRole);
            
            // 成功加入后，确保第一次滚动到底部
            scrollToBottom(); 
        } else {
            // 权限错误或连接失败，由 fetchHistory 设置 joinError
            setIsJoined(false);
        }
    };

    // 3. 处理消息发送
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        // 乐观更新：将用户消息立即添加到列表
        const newMessage = {
            sender,
            message: inputMessage,
            role: 'user',
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, newMessage]);
        // 确保滚动到底部，因为这是用户自己的消息
        setIsUserAtBottom(true);
        scrollToBottom(); 

        setIsSending(true);
        const originalMessage = inputMessage;
        setInputMessage('');

        try {
            // 调用 /api/chat
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender, message: originalMessage, aiRole }),
            });

            const data = await response.json();
            
            if (data.success) {
                // 如果 AI 回复了，下一次轮询会自动拉取
                if (data.ai_reply && data.ai_reply.includes('角色设定成功')) {
                     // 如果是角色设定成功，更新前端的 aiRole 状态
                     const roleMatch = data.ai_reply.match(/新的 AI 身份是：(.+)/);
                     if (roleMatch) {
                         const newRole = roleMatch[1].trim();
                         setAiRole(newRole);
                         sessionStorage.setItem('aiRole', newRole);
                     }
                }
            } else {
                setError(data.message || '消息发送失败');
            }
        } catch (err) {
            setError('连接服务器失败。');
            // 如果出错，把消息还给用户
            setInputMessage(originalMessage);
            setMessages(prev => prev.slice(0, -1)); // 删除乐观更新的消息
            console.error(err);
        } finally {
            setIsSending(false);
        }
    };
    
    // 4. 清空历史
    const handleClearHistory = async () => {
        if (!window.confirm('确定要清除房间所有消息记录吗？')) return;

        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });
            const data = await response.json();

            if (data.success) {
                alert(data.message);
                setMessages([]);
                // 清除成功后，立即发送心跳以刷新在线列表
                sendHeartbeat(room, sender); 
            } else {
                alert(`清除失败: ${data.message}`);
            }
        } catch (error) {
            alert('连接服务器失败，无法清除历史。');
            console.error('Clear History failed:', error);
        }
    };

    // --- 渲染部分 ---
    
    if (!isJoined) {
        return (
            <div style={simpleStyles.container}>
                <Head><title>加入聊天室</title></Head>
                <div style={simpleStyles.joinForm}>
                    <h1 style={simpleStyles.title}>双人 AI 聊天室</h1>
                    <p style={{ color: '#666', marginBottom: '20px', textAlign: 'center' }}>
                        * 聊天室号码和昵称用于区分对话和用户身份。
                    </p>
                    <input 
                        type="text" 
                        placeholder="输入您的昵称 (例如: 小王)" 
                        value={sender} 
                        onChange={(e) => setSender(e.target.value)} 
                        style={simpleStyles.input}
                    />
                    <input 
                        type="text" 
                        placeholder="输入聊天室号码 (例如: 123456)" 
                        value={room} 
                        onChange={(e) => setRoom(e.target.value)} 
                        style={simpleStyles.input}
                    />
                    <input 
                        type="text" 
                        placeholder={`AI 的角色 (当前: ${aiRole})`} 
                        value={aiRole} 
                        onChange={(e) => setAiRole(e.target.value)} 
                        style={simpleStyles.input}
                    />
                    <button onClick={handleJoin} style={simpleStyles.sendButton}>
                        加入聊天室
                    </button>
                    {joinError && <p style={simpleStyles.error}>{joinError}</p>}
                    <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#888' }}>
                         AI 角色默认为 **万能助理**。您加入后也可以使用命令修改。
                    </p>
                </div>
            </div>
        );
    }
    
    // 聊天室主界面
    return (
        <div style={simpleStyles.container}>
            <Head><title>房间 {room} - {sender}</title></Head>

            <header style={simpleStyles.header}>
                <h1 style={simpleStyles.title}>房间: {room} ({sender})</h1>
                <p style={{ fontSize: '1rem', color: '#555' }}>
                    AI 角色: <strong style={{ color: '#0070f3' }}>{aiRole}</strong>
                    <button 
                        onClick={handleClearHistory} 
                        style={simpleStyles.clearButton}
                    >
                        清空历史
                    </button>
                </p>
            </header>

            <div style={simpleStyles.main} className="main-layout">
                {/* 左侧聊天主区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    
                    {/* 聊天消息窗口 */}
                    <div 
                        ref={chatContentRef} 
                        onScroll={handleScroll} // ⭐️ 关键：监听滚动事件
                        style={simpleStyles.chatWindow} 
                        className="chat-window"
                    >
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>
                                暂无消息。向 @{AI_SENDER_NAME} 提问开始对话吧！
                            </div>
                        )}

                        {messages.map((msg, index) => {
                            const isUser = msg.sender === sender;
                            const isAI = msg.sender === AI_SENDER_NAME || msg.sender === aiRole;
                            
                            // 格式化时间戳
                            const date = new Date(msg.timestamp);
                            const timeString = date.toLocaleTimeString('zh-CN', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                hour12: false, 
                            });
                            const dateString = date.toLocaleDateString('zh-CN', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit' 
                            });

                            return (
                                <div key={index} style={simpleStyles.messageContainer(isUser)}>
                                    <div style={{ maxWidth: '100%' }}>
                                        <div style={simpleStyles.senderInfo}>
                                            {isAI ? aiRole : msg.sender} - {dateString} {timeString}
                                        </div>
                                        <div style={simpleStyles.messageBubble(isUser, isAI)}>
                                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                                                {msg.message}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* 消息输入框 */}
                    <form onSubmit={handleSubmit} style={simpleStyles.inputForm}>
                        <input
                            type="text"
                            placeholder={`向 ${aiRole} 发送消息 (使用 @${AI_SENDER_NAME} 呼叫)`}
                            value={inputMessage}
                            onChange={handleInputChange} 
                            disabled={isSending}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                            {isSending ? '发送中...' : '发送'}
                        </button>
                    </form>

                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                        * AI 仅在消息中包含 `@${AI_SENDER_NAME}` 时回复。
                        <br/>
                        * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                    </p>
                </div>

                {/* 右侧在线成员列表 */}
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