// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; 
const AI_ROLE_DEFAULT = '万能助理'; 

// --- Markdown 组件配置 (保持不变) ---
const markdownComponents = {
    a: props => <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>,
    code: ({node, inline, className, children, ...props}) => {
        return !inline ? (
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', overflowX: 'auto', border: '1px solid #ddd', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9em' }}>
                <code className={className} {...props}>{children}</code>
            </pre>
        ) : (
            <code className={className} {...props} style={{ backgroundColor: '#eee', padding: '2px 4px', borderRadius: '3px' }}>{children}</code>
        )
    }
}

// --- 样式定义 (包含新增的菜单样式) ---
const simpleStyles = {
    // ... (保持你原有的其他样式不变，为了节省篇幅省略部分，请保留原文件中的 styles) ...
    container: { minHeight: '100vh', padding: '0 0.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', color: '#333', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', },
    title: { margin: '0', lineHeight: 1.15, fontSize: '2.5rem', textAlign: 'center', marginBottom: '25px', },
    main: { padding: '2rem 0', flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: '1200px', position: 'relative', },
    chatContainer: { flex: 3, display: 'flex', flexDirection: 'column', marginRight: '20px', width: '70%', maxWidth: '70%', },
    memberListContainer: { flex: 1, padding: '15px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9', minWidth: '200px', maxWidth: '25%', },
    chatWindow: { flex: 1, overflowY: 'auto', marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#fff', minHeight: '400px', maxHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', },
    chatControls: { display: 'flex', justifyContent: 'flex-start', marginBottom: '10px', },
    clearButton: { padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem', },
    inputArea: { display: 'flex', marginTop: '10px', position: 'relative' }, // 注意：这里加了 relative 用于定位菜单
    textInput: { flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '5px 0 0 5px', fontSize: '1rem', minWidth: 0, },
    sendButton: { padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '0 5px 5px 0', cursor: 'pointer', fontSize: '1rem', whiteSpace: 'nowrap', },
    messageContainer: { display: 'flex', flexDirection: 'column', maxWidth: '75%', marginBottom: '10px', padding: '10px', borderRadius: '10px', lineHeight: 1.5, wordBreak: 'break-word', boxShadow: '0 1px 1px rgba(0,0,0,0.05)', },
    userMessage: { backgroundColor: '#e1ffc7', alignSelf: 'flex-end', },
    otherMessage: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start', },
    aiMessage: { backgroundColor: '#e6f7ff', alignSelf: 'flex-start', },
    senderName: { fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px', },
    loginForm: { display: 'flex', flexDirection: 'column', width: '300px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', },
    loginInput: { marginBottom: '10px', padding: '10px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '5px', },
    loginButton: { padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem', },
    
    // --- 新增：@ 提及菜单样式 ---
    mentionMenu: {
        position: 'absolute',
        bottom: '100%', // 在输入框上方
        left: '0',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '5px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        minWidth: '200px',
        maxHeight: '200px',
        overflowY: 'auto',
    },
    mentionItem: {
        padding: '10px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
    },
    mentionItemHover: {
        backgroundColor: '#f0f0f0',
    }
};

export default function Home() {
    // --- 状态定义 ---
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [nickname, setNickname] = useState('');
    const [room, setRoom] = useState('1');
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [aiRole, setAiRole] = useState(AI_ROLE_DEFAULT);
    const [onlineMembers, setOnlineMembers] = useState([]);
    
    // --- 新增：控制菜单显示的状态 ---
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    
    const chatWindowRef = useRef(null);

    const scrollToBottom = () => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    };

    const fetchHistory = async () => {
        if (!room || !nickname) return;
        try {
            const response = await fetch(`/api/history?room=${room}&sender=${nickname}`);
            const data = await response.json();
            if (data.success) {
                setMessages(data.history.map(msg => ({ 
                    sender: msg.sender, 
                    message: msg.message, 
                    timestamp: new Date(msg.timestamp) 
                })));
            } else if (data.message.includes("限制房间")) {
                setMessages([]);
            }
        } catch (error) {
            console.error('获取历史记录失败:', error);
        }
    };
    
    const fetchOnlineMembers = async () => {
        if (!room || !nickname) return;
        try {
            const response = await fetch(`/api/online-status?room=${room}&sender=${nickname}`);
            const data = await response.json();
            if (data.success) {
                setOnlineMembers([...new Set([AI_SENDER_NAME, ...data.members])]);
            } else if (data.message.includes("限制房间")) {
                 setOnlineMembers([AI_SENDER_NAME]);
            }
        } catch (error) {
            console.error('获取在线成员失败:', error);
        }
    };
    
    const sendHeartbeat = async () => {
        if (!isLoggedIn || !room || !nickname) return;
        try {
            await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username: nickname }),
            });
        } catch (error) {
            console.error('发送心跳失败:', error);
        }
    };
    
    useEffect(() => {
        if (isLoggedIn) {
            fetchHistory();
            fetchOnlineMembers();
            const historyInterval = setInterval(fetchHistory, 2000); 
            const statusInterval = setInterval(fetchOnlineMembers, 5000);
            const heartbeatInterval = setInterval(sendHeartbeat, 30000); 
            return () => {
                clearInterval(historyInterval);
                clearInterval(statusInterval);
                clearInterval(heartbeatInterval);
            };
        }
    }, [isLoggedIn, room, nickname]);

    useEffect(() => {
        if (isLoggedIn) {
            scrollToBottom();
        }
    }, [messages, isLoggedIn]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (nickname.trim() && room.trim()) {
            setIsLoggedIn(true);
            sendHeartbeat();
        } else {
            alert('昵称和房间号不能为空！');
        }
    };

    // --- 修改：输入框处理逻辑，检测 @ 符号 ---
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputMessage(val);

        // 简单的逻辑：如果输入的最后一个字符是 @，显示菜单
        if (val.endsWith('@')) {
            setShowMentionMenu(true);
        } else if (val.indexOf('@') === -1) {
            // 如果删除了 @，隐藏菜单
            setShowMentionMenu(false);
        }
    };

    // --- 新增：处理点击菜单项 ---
    const handleMentionSelect = (selectedName) => {
        // 移除末尾的 @ (如果存在)，因为我们是追加
        // 或者简单的做法：把 inputMessage 里的最后一个 @ 替换为 @Name
        
        const lastAtIndex = inputMessage.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const newValue = inputMessage.substring(0, lastAtIndex) + `@${selectedName} `;
            setInputMessage(newValue);
        } else {
            // 容错
            setInputMessage(prev => prev + `@${selectedName} `);
        }
        setShowMentionMenu(false);
        // 让输入框重获焦点 (可选)
        document.querySelector('input[type="text"]').focus();
    };

    const handleRoomChange = (e) => setRoom(e.target.value);
    const handleNicknameChange = (e) => setNickname(e.target.value);
    
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        setIsSending(true);
        const userMessage = inputMessage;
        setInputMessage(''); 
        setShowMentionMenu(false); // 发送后隐藏菜单

        setMessages(prev => [...prev, { 
            sender: nickname, 
            message: userMessage, 
            timestamp: new Date() 
        }]);
        
        // 角色设定逻辑
        const roleCommandMatch = userMessage.match(/^\/设定角色\s+(.+)/);
        if (roleCommandMatch) {
            const newRole = roleCommandMatch[1].trim();
            setAiRole(newRole);
            const confirmationMessage = {
                sender: AI_SENDER_NAME, 
                message: `角色设定成功：AI 现在是 **${newRole}**。`, 
                timestamp: new Date()
            };
            setMessages(prev => [...prev, confirmationMessage]);
            setIsSending(false);
            return;
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender: nickname, message: userMessage, aiRole }),
            });
            const data = await response.json();
            if (!response.ok) {
                console.error('API Error:', data.message || '未知错误');
                alert(`发送失败: ${data.message || '未知错误'}`);
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            alert('网络或服务器错误，发送失败。');
        } finally {
            setIsSending(false);
        }
    };
    
    const handleClearHistory = async () => {
        if (!window.confirm('确定要清空本房间的所有聊天记录和在线状态吗？此操作不可逆！')) return;
        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });
            if (response.ok) {
                setMessages([]);
                setOnlineMembers([AI_SENDER_NAME]);
                alert('聊天记录和在线状态已清空。');
            } else {
                const data = await response.json();
                alert(`清空失败: ${data.message || '未知错误'}`);
            }
        } catch (error) {
            console.error('清空历史记录失败:', error);
            alert('网络或服务器错误，清空失败。');
        }
    };

    const handleExportHistory = async () => {
        if (!room || !nickname) { alert("请先登录房间！"); return; }
        try {
            const response = await fetch(`/api/export-history?room=${room}&sender=${nickname}`); 
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `chat_export_${room}.html`;
                if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
                    filename = contentDisposition.split('filename=')[1].replace(/"/g, '').split(';')[0];
                }
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert(`导出失败`);
            }
        } catch (error) {
            console.error('Export Error:', error);
            alert('导出请求失败。');
        }
    };

    const renderChatMessages = () => {
        return messages.map((msg, index) => {
            const isCurrentUser = msg.sender === nickname;
            const isAI = msg.sender.replace(/\*/g, '') === AI_SENDER_NAME.replace(/\*/g, ''); 
            const style = isCurrentUser ? simpleStyles.userMessage : isAI ? simpleStyles.aiMessage : simpleStyles.otherMessage;
            const senderStyle = isCurrentUser ? { textAlign: 'right', color: '#075e54' } : { textAlign: 'left', color: isAI ? '#0070f3' : '#333' };

            return (
                <div key={index} style={{ ...simpleStyles.messageContainer, ...style }}>
                    <div style={{ ...simpleStyles.senderName, ...senderStyle }}>
                        {msg.sender} 
                        <span style={{ fontWeight: 'normal', fontSize: '0.8em', marginLeft: '8px', color: '#888' }}> 
                            {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                        {msg.message}
                    </ReactMarkdown>
                </div>
            );
        });
    };

    if (!isLoggedIn) {
        return (
            <div style={{...simpleStyles.container, justifyContent: 'flex-start', paddingTop: '100px'}}>
                <Head><title>AI 聊天室 - 登录</title></Head>
                <h1 style={simpleStyles.title}>AI 聊天室</h1>
                <form onSubmit={handleLogin} style={simpleStyles.loginForm}>
                    <h2>加入房间</h2>
                    <input type="text" placeholder="输入您的昵称" value={nickname} onChange={handleNicknameChange} style={simpleStyles.loginInput} required />
                    <input type="text" placeholder="输入房间号" value={room} onChange={handleRoomChange} style={simpleStyles.loginInput} required />
                    <button type="submit" style={simpleStyles.loginButton}>登录 / 加入房间 {room}</button>
                    <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#999', textAlign: 'center' }}>AI 角色默认是 "{AI_ROLE_DEFAULT}"</p>
                </form>
            </div>
        );
    }
    
    return (
        <div style={simpleStyles.container}>
            <Head><title>AI 聊天室 - 房间 {room}</title></Head>
            <h1 style={simpleStyles.title}>AI 聊天室 - 房间 {room} (AI 角色: {aiRole})</h1>

            <div style={simpleStyles.main} className="main-layout">
                <div style={simpleStyles.chatContainer} className="chat-container">
                    <div style={simpleStyles.chatControls}>
                        <button onClick={handleClearHistory} style={simpleStyles.clearButton}>清空历史记录</button>
                        <button onClick={handleExportHistory} style={{...simpleStyles.clearButton, marginLeft: '10px', backgroundColor: '#28a745'}}>导出历史记录 (.html)</button>
                    </div>

                    <div ref={chatWindowRef} style={simpleStyles.chatWindow} className="chat-window">
                        {messages.length > 0 ? renderChatMessages() : <div style={{ color: '#aaa', textAlign: 'center', marginTop: '50px' }}>暂无消息。发送第一条消息开始聊天吧！</div>}
                    </div>
                    
                    {/* 消息输入框区域 (相对定位) */}
                    <form onSubmit={handleSendMessage} style={simpleStyles.inputArea}>
                        
                        {/* 新增：@ 选单 */}
                        {showMentionMenu && (
                            <div style={simpleStyles.mentionMenu}>
                                {onlineMembers.map((member, idx) => (
                                    <div 
                                        key={idx} 
                                        style={simpleStyles.mentionItem}
                                        onClick={() => handleMentionSelect(member)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        @{member}
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            type="text"
                            placeholder="输入消息，@万能助理 提问..."
                            value={inputMessage}
                            onChange={handleInputChange} 
                            // 点击其他地方时关闭菜单，稍微延迟以允许点击菜单项
                            onBlur={() => setTimeout(() => setShowMentionMenu(false), 200)} 
                            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                            disabled={isSending}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>{isSending ? '发送中...' : '发送'}</button>
                    </form>

                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                        * AI 仅在消息中包含 `@${AI_SENDER_NAME}` 时回复。<br/>
                        * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                    </p>
                </div>

                <div style={simpleStyles.memberListContainer} className="member-list-container">
                    <strong>在线成员</strong><hr/>
                    {onlineMembers.length > 0 ? onlineMembers.map((member, index) => (
                        <div key={index} style={{ marginBottom: '5px', color: member === nickname ? '#0070f3' : (member === AI_SENDER_NAME ? '#075e54' : '#333'), fontWeight: member === nickname || member === AI_SENDER_NAME ? 'bold' : 'normal' }}>
                            {member} {member === nickname ? '(你)' : member === AI_SENDER_NAME ? `(AI - ${aiRole})` : ''}
                        </div>
                    )) : <div style={{ color: '#aaa', fontSize: '0.9rem' }}>正在加载或无其他成员...</div>}
                </div>
            </div>
        </div>
    );
}