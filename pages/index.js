// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // AI 的默认昵称
// -------------------

// 简单的 Markdown 渲染组件
const markdownComponents = {
    // 强制链接在新标签页打开
    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3', textDecoration: 'underline' }} />,
    // 预格式化代码块，添加背景色
    code: ({node, inline, className, children, ...props}) => {
        const match = /language-(\w+)/.exec(className || '')
        return !inline && match ? (
            <pre style={{ backgroundColor: '#f4f4f4', padding: '10px', borderRadius: '5px', overflowX: 'auto' }}>
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        ) : (
            <code className={className} {...props} style={{ backgroundColor: '#fffbe5', padding: '2px 4px', borderRadius: '3px' }}>
                {children}
            </code>
        )
    },
    // 列表项样式
    li: ({node, ...props}) => <li {...props} style={{ marginBottom: '5px' }} />,
    // 表格样式
    table: ({node, ...props}) => <table {...props} style={{ borderCollapse: 'collapse', width: '100%', margin: '10px 0' }} />,
    th: ({node, ...props}) => <th {...props} style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' }} />,
    td: ({node, ...props}) => <td {...props} style={{ border: '1px solid #ddd', padding: '8px' }} />,
};

// 定义一个简单的CSS对象来代替Home.module.css，以提供基本样式
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
        padding: '20px',
        border: '1px solid #eaeaea',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        marginRight: '20px',
        maxWidth: '800px',
    },
    memberListContainer: {
        flex: 1,
        padding: '20px',
        border: '1px solid #eaeaea',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        minWidth: '200px',
        backgroundColor: '#f9f9f9',
    },
    chatWindow: {
        height: '60vh',
        overflowY: 'auto',
        marginBottom: '15px',
        padding: '10px',
        border: '1px solid #f0f0f0',
        borderRadius: '5px',
        backgroundColor: '#fff',
    },
    messageContainer: {
        marginBottom: '10px',
        padding: '8px 12px',
        borderRadius: '15px',
        maxWidth: '85%',
        wordWrap: 'break-word',
        lineHeight: '1.4',
    },
    userMessage: {
        backgroundColor: '#e1ffc7',
        marginLeft: 'auto',
        textAlign: 'left',
        borderBottomRightRadius: '2px', // 尖角效果
    },
    aiMessage: {
        backgroundColor: '#f0f4f7',
        marginRight: 'auto',
        textAlign: 'left',
        borderBottomLeftRadius: '2px', // 尖角效果
    },
    senderName: {
        fontWeight: 'bold',
        marginBottom: '5px',
        fontSize: '0.85rem',
    },
    timestamp: {
        fontSize: '0.7rem',
        color: '#888',
        marginTop: '5px',
        display: 'block',
        textAlign: 'right', // 时间戳靠右
    },
    form: {
        display: 'flex',
        gap: '10px',
        marginTop: '15px',
    },
    textInput: {
        flexGrow: 1,
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        fontSize: '1rem',
    },
    sendButton: {
        padding: '10px 20px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
        transition: 'background-color 0.2s',
    },
    mentionDropdown: {
        position: 'absolute',
        bottom: '80px', // 确保在输入框上方
        left: '20px',
        width: 'calc(100% - 40px)', // 与 chatContainer 宽度保持一致
        maxWidth: '760px', // 匹配 chatContainer
        maxHeight: '150px',
        overflowY: 'auto',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 10,
    },
    mentionItem: {
        padding: '8px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
    }
};

/**
 * 格式化时间戳
 * @param {string | Date} timestamp - 消息时间戳
 */
const formatTime = (timestamp) => {
    // 假设 timestamp 是 ISO 字符串
    const date = new Date(timestamp);
    if (isNaN(date)) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}`;
};


export default function Home() {
    const [sender, setSender] = useState('');
    const [room, setRoom] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [aiRole, setAiRole] = useState(AI_SENDER_NAME); // 存储 AI 当前的角色
    const [onlineMembers, setOnlineMembers] = useState([]);

    // @ 提及功能状态
    const [showMention, setShowMention] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const inputRef = useRef(null);
    const chatWindowRef = useRef(null);

    // 自动滚动到底部
    useEffect(() => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    }, [messages]);

    // 心跳和消息轮询
    useEffect(() => {
        if (!isLoggedIn) return;

        // 1. 心跳 (每 30 秒)
        const sendHeartbeat = async () => {
            try {
                await fetch('/api/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, username: sender }),
                });
            } catch (error) {
                console.error('心跳发送失败:', error);
            }
        };

        // 2. 获取历史/新消息 (每 2 秒)
        const fetchMessagesAndMembers = async () => {
            if (!sender || !room) return;
            
            // 获取历史记录
            try {
                const historyRes = await fetch(`/api/history?room=${room}&sender=${sender}`);
                const historyData = await historyRes.json();
                if (historyData.success) {
                    setMessages(historyData.history || []);
                    // 检查是否有 AI 角色设定消息，更新 aiRole 状态
                    const latestRole = historyData.history
                        .filter(msg => msg.role === 'model' && msg.message.startsWith('角色设定成功'))
                        .pop();
                    if (latestRole) {
                        const match = latestRole.message.match(/新的 AI 身份是：(.+)/);
                        if (match && match[1]) {
                            setAiRole(match[1]);
                        }
                    }
                } else if (historyRes.status === 403) {
                     alert(historyData.message);
                     setIsLoggedIn(false);
                     setSender('');
                     setRoom('');
                     return;
                }
            } catch (error) {
                console.error('获取历史记录失败:', error);
            }

            // 获取在线成员
            try {
                const memberRes = await fetch(`/api/online-status?room=${room}&sender=${sender}`);
                const memberData = await memberRes.json();
                if (memberData.success) {
                    // 确保 AI 默认昵称一直在列表中
                    let membersList = memberData.members || [];
                    if (!membersList.includes(AI_SENDER_NAME)) {
                        membersList.push(AI_SENDER_NAME);
                    }
                    setOnlineMembers(membersList.sort());
                } else if (memberRes.status === 403) {
                     // 阻止继续轮询，虽然历史记录已处理，但这里再加一层保护
                     return; 
                }
            } catch (error) {
                console.error('获取在线成员失败:', error);
            }
        };

        sendHeartbeat(); // 立即发送心跳
        fetchMessagesAndMembers(); // 立即获取消息

        const heartbeatInterval = setInterval(sendHeartbeat, 30000); // 30秒
        const messageInterval = setInterval(fetchMessagesAndMembers, 2000); // 2秒

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(messageInterval);
        };
    }, [isLoggedIn, room, sender]);

    // 登录处理
    const handleLogin = (e) => {
        e.preventDefault();
        const nickname = e.target.nickname.value.trim();
        const room_id = e.target.room_id.value.trim();

        if (!nickname || !room_id) {
            alert('昵称和房间号不能为空。');
            return;
        }
        
        // 权限检查
        if (room_id === RESTRICTED_ROOM && !ALLOWED_USERS.includes(nickname)) {
            alert(`房间 ${RESTRICTED_ROOM} 是限制房间，您不被允许进入。`);
            return;
        }

        setSender(nickname);
        setRoom(room_id);
        setIsLoggedIn(true);
    };

    // 消息发送处理
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || isSending) return;

        setIsSending(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender, message, aiRole }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '发送失败');
            }

            // 成功后，清空输入框
            setMessage('');
            setMentionFilter('');
            setShowMention(false);
            
            // 立即触发一次消息轮询，以便更快看到自己的消息和 AI 的回复
            // (依赖于 useEffect 中的 fetchMessagesAndMembers)

        } catch (error) {
            console.error('发送消息失败:', error);
            alert(`发送消息失败: ${error.message}`);
        } finally {
            setIsSending(false);
        }
    };
    
    // 文本输入处理 (包含 @ 提及逻辑)
    const handleInputChange = (e) => {
        const value = e.target.value;
        setMessage(value);

        const lastAtIndex = value.lastIndexOf('@');
        
        if (lastAtIndex !== -1 && (value.length === lastAtIndex + 1 || /\s@/.test(value.substring(lastAtIndex - 1, lastAtIndex + 1)))) {
            // 确保 @ 符号前面是空格或位于句首
            const filter = value.substring(lastAtIndex + 1);
            setMentionFilter(filter);
            setShowMention(true);
        } else {
            setShowMention(false);
            setMentionFilter('');
        }
    };
    
    // 提及项选择处理
    const handleSelectMention = (member) => {
        const lastAtIndex = message.lastIndexOf('@');
        if (lastAtIndex === -1) return;

        // 替换 @ 和后面的内容为 @Member 加上一个空格
        const newMessage = message.substring(0, lastAtIndex) + `@${member} `;
        setMessage(newMessage);
        setShowMention(false);
        setMentionFilter('');

        // 重新聚焦输入框
        inputRef.current?.focus();
    };
    
    // 筛选提及列表
    const filteredMembers = useMemo(() => {
        if (!mentionFilter) return onlineMembers;
        return onlineMembers.filter(member => 
            member.toLowerCase().includes(mentionFilter.toLowerCase())
        );
    }, [onlineMembers, mentionFilter]);
    
    // ⭐️ 修复后的 handleClearHistory 函数
    const handleClearHistory = useCallback(async () => {
        if (!confirm(`确定要清空房间 ${room} 的所有聊天记录和在线状态吗？此操作不可逆！`)) {
            return;
        }

        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                setMessages([]); // 清空前端消息列表
                setOnlineMembers([AI_SENDER_NAME]); // 只保留 AI 昵称
            } else {
                alert(`清空失败: ${data.message}`);
            }
        } catch (error) {
            console.error('清空历史记录失败:', error);
            alert('清空历史记录失败，请检查网络或后端服务。');
        }
    }, [room]);


    if (!isLoggedIn) {
        return (
            <div style={simpleStyles.container}>
                <Head>
                    <title>AI 聊天室 - 登录</title>
                </Head>
                <h1 style={simpleStyles.title}>AI 聊天室 (基于 Next.js & MongoDB)</h1>
                <div style={{ padding: '20px', border: '1px solid #eaeaea', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', width: '300px' }}>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input type="text" id="nickname" name="nickname" placeholder="输入您的昵称 (例如: Didy/Shane)" defaultValue="Didy" required style={simpleStyles.textInput} />
                        <input type="text" id="room_id" name="room_id" placeholder="输入房间号 (例如: 1)" defaultValue="1" required style={simpleStyles.textInput} />
                        <button type="submit" style={simpleStyles.sendButton}>进入聊天室</button>
                    </form>
                    <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                         房间 **{RESTRICTED_ROOM}** 仅限 **{ALLOWED_USERS.join(', ')}** 访问。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>房间 {room} - {sender}</title>
            </Head>

            <h1 style={simpleStyles.title}>房间 {room} - 昵称: {sender}</h1>

            {/* 布局：聊天区(左) + 成员列表(右) */}
            <div style={simpleStyles.main} className="main-layout"> 
                {/* 左侧聊天区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                         <p>
                             AI 身份: **{aiRole}** </p>
                         <button 
                            onClick={handleClearHistory} 
                            style={{ padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem' }}
                         >
                            清空历史记录
                         </button>
                    </div>
                    
                    <div ref={chatWindowRef} style={simpleStyles.chatWindow}>
                        {messages.map((msg, index) => (
                            <div 
                                key={index} 
                                style={{
                                    ...simpleStyles.messageContainer,
                                    ...(msg.role === 'user' ? simpleStyles.userMessage : simpleStyles.aiMessage),
                                    float: msg.role === 'user' ? 'right' : 'left', // 浮动以便靠左右
                                    clear: 'both', // 清除浮动，确保消息块独立
                                }}
                            >
                                <div style={{ ...simpleStyles.senderName, color: msg.role === 'user' ? '#075e54' : '#000' }}>
                                    {msg.sender}
                                </div>
                                {/* 渲染消息内容 */}
                                <div className="chat-message-content">
                                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                                        {msg.message}
                                    </ReactMarkdown>
                                </div>
                                <div style={simpleStyles.timestamp}>
                                    {formatTime(msg.timestamp)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* @ 提及下拉菜单 */}
                    {showMention && (
                        <div style={simpleStyles.mentionDropdown}>
                            {filteredMembers.map(member => (
                                <div 
                                    key={member}
                                    style={simpleStyles.mentionItem}
                                    onClick={() => handleSelectMention(member)}
                                >
                                    @{member}
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSendMessage} style={simpleStyles.form}>
                        <input
                            ref={inputRef} // 引用输入框
                            type="text"
                            value={message}
                            placeholder={`输入消息... (当前AI: ${aiRole})`}
                            onChange={handleInputChange} 
                            disabled={isSending}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                            {isSending ? '发送中...' : '发送'}
                        </button>
                    </form>

                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                        * AI 仅在消息中包含 `@${aiRole}` 或 `@${AI_SENDER_NAME}` 时回复。
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
                            <div key={index} style={{ marginBottom: '5px', color: member === sender ? '#0070f3' : member === aiRole ? '#ff6347' : '#333' }}>
                                {member} 
                                {member === sender ? ' (你)' : member === aiRole ? ' (当前AI)' : ''}
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