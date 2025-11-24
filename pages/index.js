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
    // 聊天区域
    chatArea: {
        width: '100%',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '10px',
        height: '60vh', // 固定高度，允许滚动
        overflowY: 'auto',
        marginBottom: '10px',
        backgroundColor: '#f9f9f9',
    },
    messageContainer: (isAI, isSystem) => ({
        display: 'flex',
        justifyContent: isAI ? 'flex-start' : 'flex-end',
        marginBottom: '10px',
        fontSize: '0.95rem',
        color: isSystem ? '#999' : '#333',
    }),
    messageBubble: (isAI, isSystem) => ({
        maxWidth: '70%',
        padding: '8px 12px',
        borderRadius: '18px',
        backgroundColor: isSystem 
            ? '#fff3cd' 
            : isAI ? '#e6f7ff' : '#0070f3',
        color: isAI ? '#333' : isSystem ? '#333' : 'white',
        wordBreak: 'break-word',
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
    }),
    senderText: (isAI, isSystem) => ({
        fontSize: '0.75rem',
        color: isAI ? '#555' : '#888',
        marginBottom: '2px',
        textAlign: isAI ? 'left' : 'right',
        display: isSystem ? 'none' : 'block',
    }),
    markdownContent: {
        // 样式化 ReactMarkdown
        '& p': { margin: '0 0 5px 0' },
        '& pre': { 
            backgroundColor: '#eee', 
            padding: '10px', 
            borderRadius: '4px',
            overflowX: 'auto',
            fontSize: '0.85rem'
        },
        '& code': {
            backgroundColor: '#eee',
            padding: '2px 4px',
            borderRadius: '3px',
            fontSize: '0.85rem',
        }
    },
    // 成员列表
    memberListContainer: {
        width: '200px',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#fff',
        maxHeight: '60vh',
        overflowY: 'auto',
    },
    // 输入框
    inputForm: {
        width: '100%',
        display: 'flex',
        marginTop: '10px',
        position: 'relative', // 确保 @menu 可以相对定位
    },
    textInput: {
        flexGrow: 1,
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        marginRight: '10px',
        fontSize: '1rem',
    },
    sendButton: {
        padding: '10px 15px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '1rem',
    },
    // @ 提及菜单
    atMenu: {
        position: 'absolute',
        left: '0',
        width: 'calc(100% - 100px)', // 假设输入框是 100% - sendButtonWidth
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 999, // 确保它在最上层
    },
    atMenuItem: {
        padding: '8px 12px',
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: '#f0f0f0',
        }
    },
};

const markdownComponents = {
    // 确保列表、代码块等样式被正确渲染
    p: ({node, ...props}) => <p style={simpleStyles.markdownContent['& p']} {...props} />,
    pre: ({node, ...props}) => <pre style={simpleStyles.markdownContent['& pre']} {...props} />,
    code: ({node, inline, ...props}) => {
        if (inline) {
            return <code style={simpleStyles.markdownContent['& code']} {...props} />;
        }
        return <code {...props} />;
    }
};

export default function Home() {
    // --- 状态管理 ---
    const [sender, setSender] = useState('');
    const [room, setRoom] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [aiRole, setAiRole] = useState(AI_SENDER_NAME); // AI 初始角色
    const [systemMessage, setSystemMessage] = useState(''); // 用于显示权限错误或系统通知
    
    // @ 提及菜单状态
    const [showAtMenu, setShowAtMenu] = useState(false);
    const [filteredMembers, setFilteredMembers] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // --- 实用函数 ---
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const formatTimestamp = (date) => {
        const d = new Date(date);
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // --- API 调用函数 ---

    const fetchAiRole = async () => {
        if (!room) return;
        try {
            const response = await fetch(`/api/ai-role?room=${room}`);
            const data = await response.json();
            if (data.role) {
                setAiRole(data.role);
            }
        } catch (error) {
            console.error('Error fetching AI role:', error);
        }
    };

    const fetchHistoryAndOnlineStatus = async () => {
        if (!room || !sender) return;

        // 1. 获取消息历史
        try {
            const historyResponse = await fetch(`/api/history?room=${room}&sender=${sender}`);
            const historyData = await historyResponse.json();

            if (!historyData.success) {
                // 权限错误
                setSystemMessage(historyData.message);
                setMessages([]);
                return;
            }
            
            setMessages(historyData.history || []);
            setSystemMessage(''); // 清除之前的系统消息

        } catch (error) {
            console.error('Error fetching history:', error);
            setSystemMessage('无法连接到历史记录服务，请检查后端 API。');
        }

        // 2. 获取在线状态
        try {
            const onlineResponse = await fetch(`/api/online-status?room=${room}&sender=${sender}`);
            const onlineData = await onlineResponse.json();
            
            if (onlineData.success) {
                // 确保 AI 角色在列表中，即使它当前没有 '心跳'
                let membersList = onlineData.members || [];
                if (!membersList.includes(AI_SENDER_NAME)) {
                    membersList.push(AI_SENDER_NAME);
                }
                // 排除自己，然后排序
                membersList = membersList.filter(m => m !== sender).sort();
                // 把 AI 放在列表第一位
                membersList = membersList.includes(AI_SENDER_NAME) 
                    ? [AI_SENDER_NAME, ...membersList.filter(m => m !== AI_SENDER_NAME)]
                    : membersList;

                setOnlineMembers(membersList);
            } else {
                 // 权限错误，在线状态也被拒绝
                setSystemMessage(prev => prev || onlineData.message); // 如果没有历史错误，显示在线状态错误
                setOnlineMembers([]);
            }
        } catch (error) {
            console.error('Error fetching online status:', error);
        }
    };
    
    const sendHeartbeat = async () => {
        if (!room || !sender) return;
        try {
            await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username: sender }), // 注意：后端 API 使用了 username 字段
            });
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        // 简单校验
        if (sender.trim() && room.trim()) {
            setIsLoggedIn(true);
        } else {
            alert('昵称和房间号不能为空！');
        }
    };

    // --- @ 提及处理逻辑 (修正后的逻辑) ---
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputMessage(value);

        // 检查最后一个单词是否是 @ 提及
        const lastWordMatch = value.match(/@(\S*)$/);
        
        // 确保在线成员列表包含 AI 角色，供用户选择
        // 过滤掉自己 (sender)
        const allPossibleMentions = onlineMembers.filter(m => m !== sender); 

        if (lastWordMatch) {
            const mentionPart = lastWordMatch[1].toLowerCase();
            
            // 过滤列表：只保留匹配当前输入内容
            let membersToMention = allPossibleMentions.filter(member => 
                member.toLowerCase().startsWith(mentionPart)
            );
            
            // 如果有匹配项，或者当前输入以 '@' 结束（即用户刚输入 '@'），则显示菜单
            if (membersToMention.length > 0 || value.endsWith('@')) {
                // 确保 AI 角色是第一个选项 (为了用户体验，可以把 AI 放在首位)
                if (membersToMention.includes(AI_SENDER_NAME)) {
                    membersToMention = [AI_SENDER_NAME, ...membersToMention.filter(m => m !== AI_SENDER_NAME)];
                } else if (mentionPart === '') {
                     // 如果用户只输入了 @，且 AI 不在列表中，把 AI 加上
                    membersToMention = [AI_SENDER_NAME, ...membersToMention];
                }
                
                // 再次去重并设置状态
                setFilteredMembers(membersToMention.filter((v, i, a) => a.indexOf(v) === i));
                setShowAtMenu(true);
            } else {
                setShowAtMenu(false);
            }
        } else {
            // 如果最后一个词不是 @ 提及，则隐藏菜单
            setShowAtMenu(false);
        }
    };

    const handleAtMentionClick = (member) => {
        const currentText = inputMessage;
        // 找到最后一个 '@'
        const lastAtIndex = currentText.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            // 替换从最后一个 '@' 开始到字符串末尾的部分为 '@成员名 '
            const beforeAt = currentText.substring(0, lastAtIndex);
            const newText = beforeAt + `@${member} `;
            
            setInputMessage(newText);
            setShowAtMenu(false); // 隐藏菜单
            inputRef.current?.focus(); // 重新聚焦输入框
        }
    };
    // ----------------------------------------------------


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        setIsSending(true);

        // 1. 检查是否是 /设定角色 命令
        const roleCommandMatch = inputMessage.match(/^\/设定角色\s+(.+)/);

        if (roleCommandMatch) {
            const newRole = roleCommandMatch[1].trim();
            try {
                const response = await fetch('/api/ai-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, role: newRole }),
                });

                if (response.ok) {
                    setAiRole(newRole); // 立即更新前端状态
                    setMessages(prev => [...prev, {
                        sender: '系统',
                        message: `AI 角色已成功设定为: **${newRole}**`,
                        role: 'system',
                        timestamp: new Date().toISOString()
                    }]);
                } else {
                    alert('角色设定失败: ' + (await response.json()).message);
                }
            } catch (error) {
                console.error('Error setting AI role:', error);
                alert('网络错误，角色设定失败。');
            }
        } else {
            // 2. 普通消息发送 (包括 @AI 消息)
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, sender, message: inputMessage, aiRole }),
                });

                const data = await response.json();

                if (!data.success) {
                    alert('发送消息失败: ' + data.message);
                }
                
            } catch (error) {
                console.error('Error sending message:', error);
                alert('网络错误，消息发送失败。');
            }
        }
        
        setInputMessage('');
        setIsSending(false);
    };

    const handleClearHistory = async () => {
        if (!window.confirm('确定要清除当前房间的所有聊天记录和在线状态吗？')) return;

        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });

            if (response.ok) {
                alert('历史记录已清除！');
                setMessages([]);
                setOnlineMembers([]);
                fetchAiRole(); // 重新获取 AI 角色，确保状态刷新
            } else {
                alert('清除历史失败: ' + (await response.json()).message);
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('网络错误，清除历史失败。');
        }
    };


    // --- Effects (生命周期管理) ---

    // 初始登录时，加载 AI 角色
    useEffect(() => {
        if (isLoggedIn) {
            fetchAiRole();
        }
    }, [isLoggedIn]);


    // 定时轮询：获取消息历史、在线状态，并发送心跳
    useEffect(() => {
        if (!isLoggedIn) return;

        // 立即执行一次
        fetchHistoryAndOnlineStatus();
        sendHeartbeat(); // 发送首次心跳

        // 设置定时器进行轮询 (每 2 秒)
        const historyInterval = setInterval(fetchHistoryAndOnlineStatus, 2000);
        // 设置定时器发送心跳 (每 30 秒)
        const heartbeatInterval = setInterval(sendHeartbeat, 30000);

        // 组件卸载时清理定时器
        return () => {
            clearInterval(historyInterval);
            clearInterval(heartbeatInterval);
        };
    }, [isLoggedIn, room, sender]);


    // 消息更新后滚动到底部
    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    // --- JSX 渲染 ---

    if (!isLoggedIn) {
        return (
            <div style={simpleStyles.container}>
                <Head><title>登录 - 聊天室</title></Head>
                <h1 style={simpleStyles.title}>AI 聊天室登录</h1>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
                    <input
                        type="text"
                        placeholder="输入您的昵称 (如: 小王)"
                        value={sender}
                        onChange={(e) => setSender(e.target.value)}
                        required
                        style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                    <input
                        type="text"
                        placeholder="输入房间号 (如: 1)"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        required
                        style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                    <button type="submit" style={simpleStyles.sendButton}>进入房间</button>
                    <p style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>房间号 '{RESTRICTED_ROOM}' 是限制房间，只有 '{ALLOWED_USERS.join(' 或 ')}' 可以进入。</p>
                </form>
            </div>
        );
    }

    return (
        <div style={simpleStyles.container}>
            <Head><title>房间 {room} - 聊天室</title></Head>
            <h1 style={simpleStyles.title}>AI 聊天室 | 房间号: {room}</h1>

            <div style={{...simpleStyles.main, flexWrap: 'wrap'}} className="main-layout">
                {/* 左侧聊天区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    
                    <p style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#555' }}>
                        **当前 AI 角色**: {aiRole} 
                        <span style={{ marginLeft: '20px' }}>
                            <a href="#" onClick={handleClearHistory} style={{ color: '#d9534f', textDecoration: 'none', fontSize: '0.9rem' }}>
                                [清除历史记录]
                            </a>
                        </span>
                    </p>
                    
                    {/* 系统消息区域 (权限警告等) */}
                    {systemMessage && (
                        <div style={simpleStyles.messageContainer(false, true)}>
                            <div style={simpleStyles.messageBubble(false, true)}>{systemMessage}</div>
                        </div>
                    )}

                    {/* 消息显示区域 */}
                    <div style={simpleStyles.chatArea}>
                        {messages.map((msg, index) => {
                            const isAI = msg.sender === AI_SENDER_NAME;
                            const isSystem = msg.role === 'system';
                            const isMe = msg.sender === sender;
                            const displaySender = isMe ? '你' : msg.sender;

                            return (
                                <div key={index} style={simpleStyles.messageContainer(isAI, isSystem)}>
                                    <div style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: isAI ? 'flex-start' : 'flex-end',
                                        width: '100%',
                                    }}>
                                        <div style={simpleStyles.senderText(isAI, isSystem)}>
                                            {isAI ? msg.sender : isMe ? '你' : msg.sender} ({formatTimestamp(msg.timestamp)})
                                        </div>
                                        <div style={simpleStyles.messageBubble(isAI, isSystem)}>
                                            {/* 使用 ReactMarkdown 渲染消息内容 */}
                                            <ReactMarkdown 
                                                children={msg.message} 
                                                remarkPlugins={[remarkGfm]}
                                                components={markdownComponents}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 输入区域 */}
                    <form onSubmit={handleSubmit} style={simpleStyles.inputForm}>
                        
                        {/* @ 提及菜单 */}
                        {showAtMenu && filteredMembers.length > 0 && (
                            <div style={{ 
                                ...simpleStyles.atMenu, 
                                bottom: '55px', // 确保这个值能让菜单显示在输入框上方
                            }}>
                                {filteredMembers.map((member, index) => (
                                    <div 
                                        key={index} 
                                        style={simpleStyles.atMenuItem} 
                                        onClick={() => handleAtMentionClick(member)}
                                    >
                                        @{member}
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={`向房间发送消息，@${AI_SENDER_NAME} 提问，或输入 /设定角色 [描述]`}
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