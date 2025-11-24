// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理';
// -------------------

// 定义一个简单的CSS对象来代替Home.module.css，以提供基本样式
const simpleStyles = {
    // 外层容器
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
    // 主布局容器
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
    // 聊天主区域容器
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
    // 🚨 修复聊天内容溢出：设置固定高度并启用滚动
    chatArea: {
        width: '100%',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '10px',
        height: '600px', // 固定高度，确保滚动
        overflowY: 'auto', // 启用垂直滚动条
        display: 'flex',
        flexDirection: 'column',
    },
    // 聊天消息输入区域容器
    inputFormContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    // 🚨 修复 @ 提及：为下拉框提供定位上下文
    inputContainer: { 
        position: 'relative', 
        display: 'flex',
        width: '100%',
        marginTop: '10px',
    },
    textInput: {
        flexGrow: 1, 
        padding: '10px 15px',
        border: '1px solid #ccc',
        borderRadius: '6px 0 0 6px',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    sendButton: {
        padding: '10px 20px',
        border: 'none',
        borderRadius: '0 6px 6px 0',
        backgroundColor: '#0070f3',
        color: 'white',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
        transition: 'background-color 0.2s',
        minWidth: '80px',
    },
    // 在线成员列表
    memberListContainer: {
        width: '200px',
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        minHeight: '200px',
    },
    // 消息格式：用户消息（居右，蓝色背景）
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#d9eaff', 
        color: '#333',
        padding: '8px 12px',
        borderRadius: '15px 15px 5px 15px',
        maxWidth: '80%',
        wordBreak: 'break-word',
        marginBottom: '8px',
    },
    // 消息格式：AI/其他消息（居左，灰色背景）
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#f0f0f0', 
        color: '#333',
        padding: '8px 12px',
        borderRadius: '15px 15px 15px 5px',
        maxWidth: '80%',
        wordBreak: 'break-word',
        marginBottom: '8px',
    },
    messageHeader: {
        fontSize: '0.8rem',
        color: '#666',
        marginBottom: '4px',
    },
    // 🚨 修复 @ 提及下拉框样式
    mentionDropdown: {
        position: 'absolute',
        bottom: '100%', // 定位在输入框上方
        left: 0,
        width: 'calc(100% - 80px)', // 宽度与输入框对齐 (减去按钮宽度)
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '6px 6px 0 0',
        zIndex: 1000, // 确保它在最前面
        boxShadow: '0 -2px 5px rgba(0,0,0,0.1)',
        marginBottom: '5px',
    },
    mentionItem: {
        padding: '8px 15px',
        cursor: 'pointer',
    },
    mentionItemHover: {
        backgroundColor: '#e6f7ff',
    },
};

// Markdown 组件渲染
const markdownComponents = {
    code: ({node, inline, className, children, ...props}) => {
        const match = /language-(\w+)/.exec(className || '')
        return !inline && match ? (
            <pre style={{
                backgroundColor: '#f4f4f4',
                padding: '10px',
                borderRadius: '5px',
                overflowX: 'auto',
                fontSize: '0.9rem',
            }}>
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        ) : (
            <code className={className} {...props}>
                {children}
            </code>
        )
    }
}


export default function Home() {
    const [room, setRoom] = useState('');
    const [sender, setSender] = useState('');
    const [aiRole, setAiRole] = useState('万能助理'); // 默认角色
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [error, setError] = useState('');
    
    // @ 提及状态
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [filteredMembers, setFilteredMembers] = useState([]);

    const chatAreaRef = useRef(null);

    // --- 滚动到底部 ---
    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messages]);

    // --- 心跳更新和轮询 ---
    useEffect(() => {
        if (!isLoggedIn) return;

        const sendHeartbeat = async () => {
            await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username: sender }),
            });
        };

        const fetchAllData = () => {
            fetchHistory();
            fetchMembers();
            sendHeartbeat();
        };

        // 立即获取一次数据，然后设置定时器
        fetchAllData(); 
        const intervalId = setInterval(fetchAllData, 3000); // 3秒更新一次

        // 组件卸载时清除定时器
        return () => clearInterval(intervalId);
    }, [isLoggedIn, room, sender]);


    // --- 权限检查 ---
    const checkPermission = (currentRoom, currentSender) => {
        if (currentRoom === RESTRICTED_ROOM && !ALLOWED_USERS.includes(currentSender)) {
            setError(`对不起，房间 ${RESTRICTED_ROOM} 是限制房间。您的身份（${currentSender}）不被允许进入。请换个房间或身份。`);
            return false;
        }
        setError('');
        return true;
    };


    // --- 加入房间 ---
    const handleLogin = (e) => {
        e.preventDefault();
        if (!room.trim() || !sender.trim()) {
            setError('房间号和您的称呼不能为空。');
            return;
        }

        if (checkPermission(room, sender)) {
            setIsLoggedIn(true);
            // 登录成功后，AI 角色名默认等于 AI_SENDER_NAME
            setAiRole(AI_SENDER_NAME); 
            fetchHistory();
            fetchMembers();
        }
    };

    // --- 获取历史记录 ---
    const fetchHistory = async () => {
        if (!room || !sender) return;
        try {
            const response = await fetch(`/api/history?room=${room}&sender=${sender}`);
            const data = await response.json();
            if (data.success) {
                // 确保数据结构一致
                const formattedHistory = data.history.map(msg => ({
                    ...msg,
                    text: msg.message, // 统一使用 text 字段作为内容
                    role: msg.role || (msg.sender === AI_SENDER_NAME ? 'model' : 'user')
                }));
                setMessages(formattedHistory);
            } else {
                setError(data.message);
                if (data.message.includes('限制房间')) {
                    setIsLoggedIn(false); // 权限不足则退出登录状态
                }
            }
        } catch (err) {
            console.error('获取历史记录失败:', err);
            // 忽略常见网络错误，保持轮询
        }
    };

    // --- 获取在线成员 ---
    const fetchMembers = async () => {
        if (!room || !sender) return;
        try {
            const response = await fetch(`/api/online-status?room=${room}&sender=${sender}`);
            const data = await response.json();
            if (data.success) {
                // 确保 AI 角色名总是在线列表中，用于 @ 提及
                let members = data.members;
                if (!members.includes(AI_SENDER_NAME)) {
                    members = [AI_SENDER_NAME, ...members];
                }
                setOnlineMembers(members);
                
                // 更新 @ 提及的筛选列表（如果用户正在输入 @）
                if (inputMessage.includes('@')) {
                    const lastWord = inputMessage.split(/\s+/).pop();
                    if (lastWord.startsWith('@')) {
                        const mentionQuery = lastWord.substring(1).toLowerCase();
                        setFilteredMembers(members.filter(m => 
                            m !== sender && m.toLowerCase().includes(mentionQuery)
                        ));
                        setShowMentionDropdown(true);
                        return; // 不再执行默认的隐藏逻辑
                    }
                }
                setShowMentionDropdown(false);

            } else {
                // 权限不足错误，但仍继续保持登录状态，只是不显示成员
                if (!data.message.includes('限制房间')) { 
                    console.error('获取在线成员失败:', data.message);
                }
            }
        } catch (err) {
            console.error('获取在线成员失败:', err);
        }
    };

    // --- 清空历史记录 ---
    const handleClearHistory = async () => {
        if (!window.confirm('确定要清除当前房间的所有聊天记录吗？此操作不可逆。')) return;

        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });
            const data = await response.json();
            if (data.success) {
                alert('聊天历史记录已清除！');
                setMessages([]);
                fetchMembers(); // 刷新在线列表
            } else {
                alert('清除历史记录失败: ' + data.message);
            }
        } catch (err) {
            alert('网络错误，无法清除历史记录。');
        }
    };

    // --- 处理输入变更 (包含 @ 逻辑) ---
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputMessage(newValue);

        // 检查是否正在输入 @ 提及
        const lastWord = newValue.split(/\s+/).pop();
        if (lastWord.startsWith('@')) {
            const mentionQuery = lastWord.substring(1).toLowerCase();
            const filtered = onlineMembers.filter(m => 
                m !== sender && m.toLowerCase().includes(mentionQuery)
            );
            setFilteredMembers(filtered);
            setShowMentionDropdown(filtered.length > 0);
        } else {
            setShowMentionDropdown(false);
        }
    };

    // --- 处理选择 @ 成员 ---
    const handleSelectMention = (member) => {
        const words = inputMessage.split(/\s+/);
        words.pop(); // 移除正在输入的 @ 词
        words.push(`@${member}`);
        const newText = words.join(' ') + ' '; // 确保选择后有一个空格
        setInputMessage(newText);
        setShowMentionDropdown(false);
        // 重新聚焦到输入框
        document.querySelector('input[type="text"]').focus();
    };

    // --- 发送消息 ---
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        setIsSending(true);
        const userMessage = inputMessage.trim();
        
        // --- 1. 检查和处理 /设定角色 命令 ---
        if (userMessage.startsWith('/设定角色')) {
            const newRole = userMessage.substring(5).trim();
            if (newRole) {
                // 仅在前端更新角色状态，让 AI 在 chat.js 中接收并确认
                setAiRole(newRole); 

                // 在本地显示用户消息
                setMessages(prev => [...prev, { 
                    sender, 
                    text: userMessage, 
                    role: 'user', 
                    timestamp: new Date().toISOString() 
                }]);
                setInputMessage('');

                // 立即触发 AI 回复，以便它确认角色设定成功
                // 逻辑交给后端的 chat.js 处理，它会识别 /设定角色 命令
            } else {
                alert('请在 /设定角色 后面添加新的角色描述。');
            }
        } 
        
        // --- 2. 处理普通聊天消息或角色设定 (发送给 API) ---
        try {
            // 在本地显示用户消息
            setMessages(prev => [...prev, { 
                sender, 
                text: userMessage, 
                role: 'user', 
                timestamp: new Date().toISOString() 
            }]);
            setInputMessage('');


            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    room, 
                    sender, 
                    message: userMessage, 
                    aiRole: aiRole 
                }),
            });
            
            const data = await response.json();

            if (!data.success) {
                setError(data.message);
            }
            
            // AI 回复会在 fetchHistory 轮询中拉取，无需在此处手动添加
        } catch (err) {
            console.error('发送消息失败:', err);
            setError('发送消息失败，请检查网络或后端服务。');
            // 消息发送失败，从本地移除刚刚添加的消息
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsSending(false);
        }
    };


    // --- 渲染组件 ---

    if (!isLoggedIn) {
        return (
            <div style={simpleStyles.container}>
                <Head>
                    <title>AI 聊天室</title>
                </Head>
                <div style={simpleStyles.chatContainer}>
                    <h1 style={simpleStyles.title}>AI 聊天室 - 登录</h1>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
                        <input
                            type="text"
                            placeholder="房间号 (例: 1, 2)"
                            value={room}
                            onChange={(e) => { setRoom(e.target.value); setError(''); }}
                            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                        <input
                            type="text"
                            placeholder="您的称呼 (例: 小王)"
                            value={sender}
                            onChange={(e) => { setSender(e.target.value); setError(''); }}
                            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                        />
                        <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                            加入房间
                        </button>
                    </form>
                    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                </div>
            </div>
        );
    }

    // 聊天窗口主体
    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>房间 {room} - AI 聊天室</title>
            </Head>

            <div style={simpleStyles.main} className="main-layout">
                {/* 左侧聊天窗口 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    <h1 style={simpleStyles.title}>房间 {room} - {sender}</h1>
                    <p>AI 角色: **{aiRole}** <button onClick={handleClearHistory} style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer' }}>清空历史</button></p>
                    
                    {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}

                    {/* 🚨 修复对话格式和滚动：chatArea */}
                    <div style={simpleStyles.chatArea} ref={chatAreaRef}>
                        {messages.length === 0 ? (
                            <p style={{ color: '#aaa', textAlign: 'center', marginTop: '100px' }}>暂无消息，开始聊天吧！</p>
                        ) : (
                            messages.map((msg, index) => {
                                // 确定消息样式
                                const isUser = msg.sender === sender;
                                const messageStyle = isUser ? simpleStyles.userMessage : simpleStyles.aiMessage;
                                
                                // 格式化时间
                                const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
                                
                                return (
                                    <div key={index} style={messageStyle}>
                                        <div style={simpleStyles.messageHeader}>
                                            <strong style={{ color: isUser ? '#0070f3' : '#a020f0' }}>{msg.sender}</strong> 
                                            <span style={{ marginLeft: '10px', color: '#999' }}>{timestamp}</span>
                                        </div>
                                        <div className="chat-message-content">
                                            {/* 使用 ReactMarkdown 渲染内容，支持代码块和 markdown 格式 */}
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]} 
                                                components={markdownComponents}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* 🚨 修复 @ 提及：输入表单区域 */}
                    <div style={simpleStyles.inputFormContainer}>
                        <div style={simpleStyles.inputContainer}>
                            {/* 提及下拉框 */}
                            {showMentionDropdown && filteredMembers.length > 0 && (
                                <div style={simpleStyles.mentionDropdown}>
                                    {filteredMembers.map(member => (
                                        <div 
                                            key={member} 
                                            style={simpleStyles.mentionItem} 
                                            // 简单的 hover 效果
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = simpleStyles.mentionItemHover.backgroundColor}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = simpleStyles.mentionItem.backgroundColor}
                                            onClick={() => handleSelectMention(member)}
                                        >
                                            @{member} {member === AI_SENDER_NAME ? '(AI)' : ''}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleSendMessage} style={{ display: 'flex', width: '100%' }}>
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={handleInputChange} 
                                    disabled={isSending}
                                    placeholder={`在房间 ${room} 中发言...`}
                                    style={simpleStyles.textInput}
                                />
                                <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                                    {isSending ? '发送中...' : '发送'}
                                </button>
                            </form>
                        </div>

                        <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                            * AI 仅在被 **@{AI_SENDER_NAME}** 提及或使用 **`/设定角色`** 命令时回复。
                        </p>
                    </div>


                </div>

                {/* 右侧在线成员列表 */}
                <div style={simpleStyles.memberListContainer} className="member-list-container">
                    <strong>在线成员 ({onlineMembers.length})</strong>
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