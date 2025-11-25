// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // AI 的昵称
// -------------------

// 定义一个简单的CSS对象来代替Home.module.css，以提供基本样式 (保留上一次提供的样式)
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
        position: 'relative', // 用于定位 mention 列表
    },
    chatWindow: {
        height: '500px', 
        overflowY: 'scroll', 
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
        position: 'relative',
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
    utilityButtons: { 
        display: 'flex',
        gap: '10px',
        marginLeft: '15px',
    },
    clearButton: {
        padding: '5px 10px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#f0f0f0',
        color: '#d9534f',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    exportButton: { 
        padding: '5px 10px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#e6f7ff',
        color: '#0070f3',
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
    },
    // ⭐️ Mention 列表样式
    mentionList: {
        position: 'absolute',
        bottom: '60px', // 定位到输入框上方
        left: '10px',
        zIndex: 10,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '5px',
        width: 'calc(100% - 130px)', // 占据输入框的宽度
        maxHeight: '150px',
        overflowY: 'auto',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        padding: '5px 0',
    },
    mentionItem: {
        padding: '8px 15px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
    },
    mentionItemHover: {
        backgroundColor: '#f0f0f0',
    },
};

const markdownComponents = {
    p: ({ node, ...props }) => <p style={{ margin: '0 0 5px 0' }} {...props} />,
    br: ({ node, ...props }) => <br {...props} />,
    table: ({ node, ...props }) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '10px 0' }} {...props} />,
    th: ({ node, ...props }) => <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' }} {...props} />,
    td: ({ node, ...props }) => <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }} {...props} />,
};


export default function ChatRoom() {
    // --- 状态和 Refs ---
    const [sender, setSender] = useState('');
    const [room, setRoom] = useState('');
    const [aiRole, setAiRole] = useState('万能助理');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [onlineMembers, setOnlineMembers] = useState([AI_SENDER_NAME]);
    const [isInitialized, setIsInitialized] = useState(false);
    
    // 滚动相关
    const chatContentRef = useRef(null);
    const [isUserAtBottom, setIsUserAtBottom] = useState(true); 

    // 加入相关
    const [isJoined, setIsJoined] = useState(false); 
    const [joinError, setJoinError] = useState(''); 

    // ⭐️ Mention 相关状态
    const [showMention, setShowMention] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const inputRef = useRef(null);
    
    // --- 滚动逻辑函数 (与上一版一致) ---
    const scrollToBottom = () => {
        if (chatContentRef.current) {
            chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
        }
    };

    const handleScroll = () => {
        if (chatContentRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContentRef.current;
            const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
            
            if (isUserAtBottom !== isNearBottom) {
                 setIsUserAtBottom(isNearBottom);
            }
        }
    };

    // --- API 交互函数 (省略了 fetchHistory, sendHeartbeat, fetchOnlineMembers, handleClearHistory，与上一版一致) ---
    
    // 1. 获取消息历史 (保持与上一版一致)
    const fetchHistory = useCallback(async (currentRoom, currentSender) => {
        if (!currentRoom || !currentSender) return false;

        try {
            const response = await fetch(`/api/history?room=${currentRoom}&sender=${currentSender}`);
            const data = await response.json();
            
            if (response.status === 403) {
                setJoinError(data.message || '权限错误，无法获取历史记录。');
                return false;
            }
            
            if (data.success) {
                setMessages(data.history || []);
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
    }, [isInitialized]);
    
    // ... 其他 API 函数 (sendHeartbeat, fetchOnlineMembers, handleClearHistory, handleExportHistory) 保持不变或与上一版一致 ...

    // 4. 处理消息发送 (保持与上一版一致)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        // 乐观更新
        const newMessage = {
            sender,
            message: inputMessage,
            role: 'user',
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, newMessage]);
        setIsUserAtBottom(true);
        scrollToBottom(); 

        setIsSending(true);
        const originalMessage = inputMessage;
        setInputMessage('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender, message: originalMessage, aiRole }),
            });

            const data = await response.json();
            
            if (data.success) {
                // 检查是否是角色设定命令
                if (data.ai_reply && data.ai_reply.includes('角色设定成功')) {
                     // 假设 AI 返回格式是 '角色设定成功，新的 AI 身份是：[新角色]'
                     const roleMatch = data.ai_reply.match(/新的 AI 身份是：(.+)/);
                     if (roleMatch) {
                         const newRole = roleMatch[1].trim();
                         setAiRole(newRole);
                         sessionStorage.setItem('aiRole', newRole);
                     } else {
                         // 如果没有匹配到，但 AI 说成功了，则默认为万能助理
                         const defaultRole = AI_SENDER_NAME;
                         setAiRole(defaultRole);
                         sessionStorage.setItem('aiRole', defaultRole);
                     }
                }
            } else {
                setError(data.message || '消息发送失败');
            }
        } catch (err) {
            setError('连接服务器失败。');
            setInputMessage(originalMessage);
            setMessages(prev => prev.slice(0, -1)); 
            console.error(err);
        } finally {
            setIsSending(false);
        }
    };
    
    // --- ⭐️ 新增 Mention 逻辑 ---
    
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputMessage(value);

        const caretPos = inputRef.current.selectionStart;
        const subString = value.substring(0, caretPos);
        const lastAt = subString.lastIndexOf('@');

        if (lastAt !== -1 && lastAt === subString.length - 1) {
            // 只有当 '@' 是最后一个字符时才显示列表
            setMentionFilter('');
            setShowMention(true);
        } else if (lastAt !== -1 && subString.length > lastAt + 1) {
            // 如果 '@' 后面有字符，开始过滤
            const filter = subString.substring(lastAt + 1);
            setMentionFilter(filter);
            setShowMention(true);
        } else {
            setShowMention(false);
        }
    };

    const handleSelectMention = (member) => {
        const caretPos = inputRef.current.selectionStart;
        const subString = inputMessage.substring(0, caretPos);
        const lastAt = subString.lastIndexOf('@');
        
        if (lastAt !== -1) {
            const newText = 
                inputMessage.substring(0, lastAt + 1) + 
                member + 
                ' ' + 
                inputMessage.substring(caretPos);
            
            setInputMessage(newText);
            setShowMention(false);
            
            // 自动将焦点和光标移动到提及后的空格
            setTimeout(() => {
                const newCaretPos = lastAt + 1 + member.length + 1;
                inputRef.current.setSelectionRange(newCaretPos, newCaretPos);
                inputRef.current.focus();
            }, 0);
        }
    };
    
    // 过滤后的在线成员列表 (排除用户自己)
    const filteredMembers = onlineMembers
        .filter(m => m !== sender)
        .filter(m => m.toLowerCase().includes(mentionFilter.toLowerCase()));


    // --- Hook: 自动滚动和初始化 (与上一版一致) ---
    useEffect(() => {
        if (isUserAtBottom && chatContentRef.current) {
            scrollToBottom();
        }
    }, [messages, isUserAtBottom]); 

    useEffect(() => {
        const savedSender = sessionStorage.getItem('sender');
        const savedRoom = sessionStorage.getItem('room');
        const savedAiRole = sessionStorage.getItem('aiRole') || AI_SENDER_NAME;

        if (savedSender && savedRoom) {
            setSender(savedSender);
            setRoom(savedRoom);
            setAiRole(savedAiRole);
            
            fetchHistory(savedRoom, savedSender).then(success => {
                if (success) {
                    setIsJoined(true);
                }
            });
        }
    }, [fetchHistory]);

    // --- Hook: 轮询逻辑 (与上一版一致) ---
    // ... (保持与上一版一致的 useEffect 轮询逻辑) ...
    // 请确保您的其他 API 函数（sendHeartbeat, fetchOnlineMembers, handleClearHistory, handleExportHistory）与上一版一致并已实现。

    // 6. 导出历史记录 (请确保您已在 pages/api/目录下新增 export-history.js)
    const handleExportHistory = async () => { /* ... 保持与上一版一致 ... */ };

    
    // --- 格式化时间戳函数 (时间修正逻辑已包含) ---
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        
        // ⭐️ 修正：强制使用 UTC 时间，并手动调整到 UTC+8 (北京时间)
        const dateUTC = new Date(date.getTime() + (8 * 60 * 60 * 1000));

        const hour = dateUTC.getUTCHours().toString().padStart(2, '0');
        const minute = dateUTC.getUTCMinutes().toString().padStart(2, '0');
        const year = dateUTC.getUTCFullYear();
        const month = (dateUTC.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = dateUTC.getUTCDate().toString().padStart(2, '0');

        return {
            timeString: `${hour}:${minute}`,
            dateString: `${year}/${month}/${day}`
        };
    };

    // 2. 处理加入聊天室 (与上一版一致)
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
            scrollToBottom(); 
        } else {
            setIsJoined(false);
        }
    };

    // --- 渲染部分 ---
    
    if (!isJoined) {
        // ... (加入表单渲染与上一版一致) ...
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
                <div style={simpleStyles.utilityButtons}>
                    <p style={{ fontSize: '1rem', color: '#555', margin: 0, padding: '5px 0' }}>
                        AI 角色: <strong style={{ color: '#0070f3' }}>{aiRole}</strong>
                    </p>
                    {/* 导出按钮 (假设 handleExportHistory 已在您的代码中实现) */}
                    <button 
                        onClick={handleExportHistory} 
                        style={simpleStyles.exportButton}
                    >
                        导出记录
                    </button>
                    {/* 清空按钮 (假设 handleClearHistory 已在您的代码中实现) */}
                    <button 
                        onClick={handleClearHistory} 
                        style={simpleStyles.clearButton}
                    >
                        清空历史
                    </button>
                </div>
            </header>

            <div style={simpleStyles.main} className="main-layout">
                {/* 左侧聊天主区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    
                    {/* 聊天消息窗口 */}
                    <div 
                        ref={chatContentRef} 
                        onScroll={handleScroll} 
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
                            
                            const { dateString, timeString } = formatTimestamp(msg.timestamp);

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
                        
                        {/* ⭐️ Mention 列表 */}
                        {showMention && filteredMembers.length > 0 && (
                            <div style={simpleStyles.mentionList}>
                                {filteredMembers.map((member, index) => (
                                    <div 
                                        key={index} 
                                        style={simpleStyles.mentionItem}
                                        // 添加简单的 hover 效果
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = simpleStyles.mentionItemHover.backgroundColor}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                        onClick={() => handleSelectMention(member)}
                                    >
                                        @{member}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <input
                            ref={inputRef} // 绑定 ref
                            type="text"
                            placeholder={`向 ${aiRole} 发送消息 (使用 @ 呼叫)`}
                            value={inputMessage}
                            onChange={handleInputChange} 
                            disabled={isSending}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                            {isSending ? '发送中...' : '发送'}
                        </button>
                    </form>

                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666', paddingLeft: '10px' }}>
                        * AI 仅在消息中包含 `@${AI_SENDER_NAME}` 时回复。
                        <br/>
                        * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                    </p>
                </div>

                {/* 右侧在线成员列表 (与上一版一致) */}
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