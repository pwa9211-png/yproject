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
        position: 'relative', 
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
    },
    memberListContainer: {
        width: '200px',
        border: '1px solid #ddd',
        padding: '10px',
        borderRadius: '4px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginTop: '105px', 
    },
    memberSelectMenu: {
        position: 'absolute',
        bottom: '50px', 
        left: '0',
        width: '200px',
        maxHeight: '150px',
        overflowY: 'auto',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        zIndex: 10,
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    },
    memberSelectItem: {
        padding: '8px',
        cursor: 'pointer',
    },
    memberSelectItemHover: {
        backgroundColor: '#f0f0f0',
    },
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
    
    // AI 角色设定为新的通用名称
    const aiRole = `**${AI_SENDER_NAME}**`; 
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);


    // 获取在线成员列表 (关键修复点 1)
    const fetchOnlineMembers = async (currentRoom, currentSender) => {
        if (!currentRoom) {
            // 确保即使没有房间信息，AI 也应该出现在列表中，防止列表为空
            setOnlineMembers([currentSender, AI_SENDER_NAME]);
            return;
        }

        let membersFromApi = [];
        try {
            const res = await fetch(`/api/online-status?room=${currentRoom}&sender=${currentSender}`);
            const data = await res.json();
            
            if (res.ok && data.members && Array.isArray(data.members)) {
                // 提取成员名称
                membersFromApi = data.members.map(m => m.sender);
            }
        } catch (err) {
            // API 失败时，membersFromApi 保持为空数组
            console.error("Failed to fetch online members:", err);
        }

        // 构建最终列表：确保包含当前用户和AI，并且无重复
        const uniqueMembers = new Set([currentSender, AI_SENDER_NAME, ...membersFromApi]);
        const finalMembers = Array.from(uniqueMembers);
        
        // 确保当前用户在第一个位置（如果存在）
        finalMembers.sort((a, b) => {
            if (a === currentSender) return -1;
            if (b === currentSender) return 1;
            return 0;
        });

        setOnlineMembers(finalMembers);
    };

    // 设置心跳和在线状态轮询
    useEffect(() => {
        if (!isLoggedIn) return;

        // 立即获取一次
        fetchOnlineMembers(room, sender);

        // 设置定时器获取在线状态和心跳
        const interval = setInterval(() => {
            fetchOnlineMembers(room, sender);
        }, 15000); 

        return () => clearInterval(interval);
    }, [isLoggedIn, room, sender]); // 依赖项检查

    // 加载历史消息的逻辑 (代码不变)
    const fetchHistory = async (currentRoom) => {
        if (!currentRoom) return;
        try {
            const res = await fetch(`/api/history?room=${currentRoom}`);
            const data = await res.json();
            if (res.ok) {
                setChatHistory(data.history || []); 
                setError(null);
            } else {
                setChatHistory([]);
                setError(`无法加载聊天历史，请检查后端配置和网络连接。错误信息: ${data.message || '未知错误'}`);
            }
        } catch (err) {
            setChatHistory([]);
            setError(`无法加载聊天历史，请检查后端配置和网络连接。错误信息: ${err.message}`);
        }
    };

    // 登录/加入房间逻辑 (代码不变)
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

    // 清空历史逻辑 (代码不变)
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


    // 处理输入变化和 @ 菜单 (关键修复点 2：更严格的 @ 检查)
    const handleInputChange = (e) => {
        const value = e.target.value;
        setMessage(value);

        // 查找最后一个非空格的 @ 符号的位置
        let lastAtIndex = -1;
        for (let i = value.length - 1; i >= 0; i--) {
            if (value[i] === '@') {
                lastAtIndex = i;
                break;
            }
            // 如果遇到空格，则停止查找，因为 @ 后面不能有空格才能触发菜单
            if (value[i] === ' ') {
                lastAtIndex = -1; 
                break;
            }
        }
        
        // 只有当 @ 位于末尾或者 @ 后正在输入内容时才触发
        if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
             // 只有 @ 符号：显示所有成员 (排除自己)
            const list = onlineMembers.filter(m => m !== sender);
            setFilteredMembers(list);
            setShowMemberSelect(true);
        } else if (lastAtIndex !== -1 && lastAtIndex < value.length - 1) {
            // 在 @ 后面输入了内容：进行筛选
            const query = value.substring(lastAtIndex + 1).toLowerCase();
            const list = onlineMembers.filter(m => m !== sender && m.toLowerCase().includes(query));
            setFilteredMembers(list);
            setShowMemberSelect(true);
        } else {
            // 没有有效的 @ 符号，隐藏菜单
            setShowMemberSelect(false);
            setFilteredMembers([]);
        }
    };
    
    // 选择成员 (代码不变)
    const selectMember = (member) => {
        const lastAtIndex = message.lastIndexOf('@');
        
        // 替换 @ 及其后的内容为 @[成员]
        const newMessage = message.substring(0, lastAtIndex) + `@${member} `;
        
        setMessage(newMessage);
        setShowMemberSelect(false);
        inputRef.current.focus();
    };

    // 发送消息逻辑 (代码不变)
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


    // 登录界面 (代码不变)
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

    // 主聊天界面 - 采用左右布局
    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>多人 AI 智能聊天室</title>
            </Head>

            <div style={simpleStyles.main}>
                
                {/* 左侧主要聊天区域 */}
                <div style={simpleStyles.chatContainer}>
                    
                    <h1 style={simpleStyles.title}>
                        <span role="img" aria-label="robot">🤖</span>
                        <span role="img" aria-label="person">🧑‍💻</span> 
                        多人 AI 智能聊天室
                    </h1>

                    <div style={simpleStyles.chatHeader}>
                        <span>当前房间: **{room}** | AI 角色: {aiRole} ({sender})</span>
                        <div>
                            <button onClick={() => alert("导出对话功能待实现")} style={{ ...simpleStyles.sendButton, backgroundColor: '#6c757d', marginRight: '10px' }}>导出对话 (HTML)</button>
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
                                    <ReactMarkdown children={msg.message} remarkPlugins={[remarkGfm]} />
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    
                    <form onSubmit={sendMessage} style={simpleStyles.inputArea}>
                        
                        {/* 成员选择菜单 */}
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

                {/* 右侧在线成员列表 */}
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