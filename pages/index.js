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

// --- 颜色分配函数和常量 ---
// 消息背景色数组，用于分配给不同的非 AI/非自己用户
const USER_COLORS = [
    '#4CAF50', // 绿色
    '#FF9800', // 橙色
    '#9C27B0', // 紫色
    '#E91E63', // 粉色
    '#795548'  // 棕色
];

/**
 * 根据发送者名称动态获取消息框样式
 * @param {string} senderName - 消息发送者
 * @param {string[]} onlineMembers - 当前在线成员列表
 * @returns {Object} 消息框的动态 style 对象
 */
function getUserColor(senderName, onlineMembers) {
    // 1. AI 消息样式：白色背景，靠左
    if (senderName === AI_SENDER_NAME) {
        return { 
            backgroundColor: 'white', 
            color: '#333', 
            borderColor: '#e0e0e0',
            float: 'left', 
            marginRight: 'auto',
            borderBottomLeftRadius: '2px', // 尖角在左
            border: '1px solid #e0e0e0'
        }; 
    }
    
    // 2. 其他用户消息样式：动态颜色，靠左
    // 动态分配颜色给其他用户 (排除 AI)
    const otherMembers = onlineMembers.filter(m => m !== AI_SENDER_NAME);
    const index = otherMembers.indexOf(senderName);
    
    if (index !== -1) {
        const colorIndex = index % USER_COLORS.length;
        return {
            backgroundColor: USER_COLORS[colorIndex],
            color: 'white', // 彩色背景，白色字体
            borderColor: USER_COLORS[colorIndex],
            float: 'left', 
            marginRight: 'auto',
            borderBottomLeftRadius: '2px' 
        };
    }

    // 3. 默认回退样式（用于找不到发送者的情况，仍靠左）
    return { 
        backgroundColor: '#f9f9f9', 
        color: '#333', 
        borderColor: '#ccc',
        float: 'left',
        marginRight: 'auto',
        borderBottomLeftRadius: '2px'
    };
}
// -------------------

// --- 样式定义 (simpleStyles) ---
// 消息的背景和对齐将被动态覆盖，此处保留基础样式
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
    title: {
        margin: '0',
        lineHeight: 1.15,
        fontSize: '2.5rem',
        textAlign: 'center',
        marginBottom: '25px',
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
    memberListContainer: {
        width: '200px', 
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        position: 'sticky',
        top: '20px', 
    },
    chatArea: {
        width: '100%',
        height: '600px', 
        overflowY: 'auto',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '15px',
        display: 'flex',
        flexDirection: 'column', // 使消息垂直排列
    },
    messageContainer: {
        marginBottom: '15px',
        padding: '12px 16px',
        borderRadius: '12px',
        clear: 'both',
        overflow: 'hidden',
        maxWidth: '85%', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        wordBreak: 'break-word', // 确保长单词或URL不溢出
    },
    inputArea: {
        width: '100%',
        display: 'flex',
        marginTop: '10px',
    },
    textInput: {
        flex: 1,
        padding: '10px 15px',
        border: '1px solid #ccc',
        borderRadius: '6px 0 0 6px',
        fontSize: '1rem',
        outline: 'none',
    },
    sendButton: {
        padding: '10px 20px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '0 6px 6px 0',
        cursor: 'pointer',
        fontSize: '1rem',
        outline: 'none',
    },
    errorBox: {
        color: '#c00',
        marginBottom: '20px',
        border: '1px solid #fcc',
        padding: '10px',
        borderRadius: '5px',
        backgroundColor: '#fee',
        textAlign: 'center',
        width: '100%',
    }
};

// Markdown 渲染组件
const markdownComponents = {
    p: ({node, ...props}) => <p style={{margin: '0 0 10px 0', lineHeight: '1.6', whiteSpace: 'pre-wrap'}} {...props} />,
    ul: ({node, ...props}) => <ul style={{paddingLeft: '20px', margin: '10px 0'}} {...props} />,
    ol: ({node, ...props}) => <ol style={{paddingLeft: '20px', margin: '10px 0'}} {...props} />,
    li: ({node, ...props}) => <li style={{marginBottom: '5px'}} {...props} />,
    code: ({node, inline, ...props}) => {
        // 对于行内代码和代码块使用不同的样式
        return inline ? (
            <code style={{ 
                backgroundColor: 'rgba(0,0,0,0.05)', 
                padding: '2px 4px', 
                borderRadius: '3px',
                color: '#c7254e'
            }} {...props} />
        ) : (
            <pre style={{ 
                backgroundColor: '#f4f4f4', 
                padding: '10px', 
                borderRadius: '5px', 
                overflowX: 'auto',
                border: '1px solid #ddd'
            }}>
                <code {...props} />
            </pre>
        );
    }
};
// -------------------

export default function Home() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [room, setRoom] = useState('');
    const [sender, setSender] = useState('');
    const [aiRole, setAiRole] = useState(AI_SENDER_NAME); // AI的当前角色名
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [onlineMembers, setOnlineMembers] = useState([]); // 在线成员列表

    const chatAreaRef = useRef(null);

    // 滚动到底部
    const scrollToBottom = () => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    };

    // --- 1. 获取聊天历史和权限检查 ---
    const fetchHistory = async () => {
        if (!room || !sender || !isLoggedIn) return;

        try {
            // API需要 room 和 sender 参数进行权限检查
            const res = await fetch(`/api/history?room=${room}&sender=${sender}`);
            const data = await res.json();

            if (res.ok) {
                // 如果成功，清空权限错误并设置历史记录
                setError('');
                if (data.history) {
                    setChatHistory(data.history);
                }
            } else if (res.status === 403) {
                // 收到 403 权限错误，清空历史并显示错误信息
                setChatHistory([]);
                setError(data.message); 
            } else {
                console.error(`Fetch history failed: ${data.message}`);
            }
        } catch (err) {
            console.error(`Fetch history network error:`, err);
        }
    };

    // --- 2. 获取在线状态 ---
    const fetchOnlineStatus = async () => {
        if (!room || !sender || !isLoggedIn) return;

        try {
            // API需要 room 和 sender 参数进行权限检查
            const res = await fetch(`/api/online-status?room=${room}&sender=${sender}`);
            const data = await res.json();

            if (res.ok) {
                // 如果成功，清空权限错误并设置在线成员
                setError('');
                // 从 OnlineUser 文档中提取 username (即 sender)
                const members = data.members.map(m => m.username || m.sender); 
                // 确保 AI 角色也在列表中，但避免重复
                if (!members.includes(AI_SENDER_NAME)) {
                    members.push(AI_SENDER_NAME);
                }
                setOnlineMembers(members);
            } else if (res.status === 403) {
                // 收到 403 权限错误，清空在线列表并显示错误信息
                setOnlineMembers([]);
                setError(data.message); 
            } else {
                console.error(`Fetch online status failed: ${data.message}`);
            }
        } catch (err) {
            console.error(`Fetch online status network error:`, err);
        }
    };


    // --- 3. 心跳更新 ---
    const sendHeartbeat = async () => {
        if (!room || !sender || !isLoggedIn) return;

        try {
            const res = await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 注意：heartbeat API 需使用 username 字段
                body: JSON.stringify({ room: room, username: sender }) 
            });

            if (!res.ok) {
                console.error('Heartbeat failed', await res.json());
            }
        } catch (err) {
            console.error('Heartbeat network error', err);
        }
    };

    // --- 4. 清空历史记录 ---
    const clearHistory = async () => {
        if (!room || !sender || isSending) return;
        
        const confirmClear = window.confirm(`确定要清空房间 ${room} 的所有对话记录和在线状态吗？`);
        if (!confirmClear) return;

        setIsSending(true);
        try {
            const res = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`清空成功: ${data.message}`);
                setChatHistory([]); // 清空前端显示
                fetchOnlineStatus(); // 刷新在线列表
            } else {
                alert(`清空失败: ${data.message}`);
            }
        } catch (error) {
            alert('清空操作失败，请检查网络或日志。');
            console.error('Clear history error:', error);
        } finally {
            setIsSending(false);
        }
    };

    // --- 5. 导出 HTML ---
    const exportHistory = () => {
        if (chatHistory.length === 0) {
            alert('没有历史记录可供导出。');
            return;
        }
        
        // 使用动态颜色和对齐逻辑来生成 HTML 内容
        const formattedMessages = chatHistory.map(msg => {
            const isCurrentUser = msg.sender === sender;
            const isAI = msg.sender === AI_SENDER_NAME;
            
            let dynamicStyle;
            if (isCurrentUser) {
                dynamicStyle = { backgroundColor: '#0070f3', color: 'white', float: 'right', marginLeft: 'auto', borderBottomRightRadius: '2px' };
            } else {
                dynamicStyle = getUserColor(msg.sender, onlineMembers); // 调用相同的颜色函数
            }

            const senderName = msg.sender;
            
            return `
                <div style="
                    margin-bottom: 15px; 
                    padding: 12px 16px; 
                    border-radius: 12px; 
                    max-width: 85%; 
                    float: ${isCurrentUser ? 'right' : 'left'}; 
                    clear: both; 
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    background-color: ${dynamicStyle.backgroundColor};
                    color: ${dynamicStyle.color};
                    border: ${isAI ? '1px solid #e0e0e0' : 'none'};
                    margin-left: ${isCurrentUser ? 'auto' : '0'};
                    margin-right: ${isCurrentUser ? '0' : 'auto'};
                    border-bottom-right-radius: ${isCurrentUser ? '2px' : '12px'};
                    border-bottom-left-radius: ${isCurrentUser ? '12px' : '2px'};
                ">
                    ${!isCurrentUser ? `
                        <strong style="
                            display: block; 
                            margin-bottom: 5px; 
                            color: ${isAI ? '#0070f3' : (dynamicStyle.color === 'white' ? 'white' : '#333')};
                        ">${senderName}:</strong>
                    ` : ''}
                    <div style="white-space: pre-wrap; color: ${dynamicStyle.color}; text-align: left;">${msg.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
            `;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>聊天记录 - 房间 ${room}</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd;">
                <h2>房间 ${room} 聊天记录</h2>
                <p>导出用户: ${sender} | AI 角色: ${aiRole} | 导出时间: ${new Date().toLocaleString()}</p>
                <div style="width: 100%; border: 1px solid #ccc; padding: 15px; margin-top: 20px;">
                    ${formattedMessages}
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_room_${room}_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    // --- 6. 消息发送逻辑 ---
    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim() || isSending || !room || !sender || !isLoggedIn) return;

        const messageToSend = message.trim();
        setMessage(''); 
        setIsSending(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender, message: messageToSend, aiRole })
            });

            const data = await res.json();

            if (res.ok) {
                // 发送成功，强制刷新历史记录来更新 UI
                await fetchHistory(); 
            } else if (res.status === 403) {
                setError(data.message); // 显示权限错误
            } else {
                setError(data.message || '消息发送失败');
            }

        } catch (err) {
            setError('网络错误，消息发送失败');
            console.error('Send message network error:', err);
        } finally {
            setIsSending(false);
        }
    };
    
    // --- 7. 登录处理逻辑 ---
    const handleLogin = (e) => {
        e.preventDefault();
        const trimmedRoom = room.trim();
        const trimmedSender = sender.trim();

        if (trimmedRoom && trimmedSender) {
            // 权限检查 (前端模糊化错误)
            if (trimmedRoom === RESTRICTED_ROOM && !ALLOWED_USERS.includes(trimmedSender)) {
                // 后端 API 会做真正的权限检查，这里只是为了快速防止
                setError(`房间 ${trimmedRoom} 需要特殊权限，请确认您的昵称。`);
                return;
            }

            setIsLoggedIn(true);
            setError(''); // 清空可能的错误信息
            
            // 立即发起首次心跳和获取历史记录
            sendHeartbeat();
            fetchHistory();
            fetchOnlineStatus();

        } else {
            setError('房间号和昵称不能为空。');
        }
    };

    // --- 8. 轮询效果 ---
    useEffect(() => {
        let historyInterval, heartbeatInterval, onlineStatusInterval;

        if (isLoggedIn && !error) {
            // 每 2 秒获取一次历史记录和在线状态
            historyInterval = setInterval(fetchHistory, 2000); 
            onlineStatusInterval = setInterval(fetchOnlineStatus, 2000); 
            // 每 30 秒发送一次心跳
            heartbeatInterval = setInterval(sendHeartbeat, 30000); 
        }

        // 清理函数
        return () => {
            if (historyInterval) clearInterval(historyInterval);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (onlineStatusInterval) clearInterval(onlineStatusInterval);
        };
    }, [isLoggedIn, room, sender, error]); // 依赖 isLoggedIn, room, sender 和 error

    // 消息历史更新后，自动滚动到底部
    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);

    // 导出文件时使用的简单输入处理
    const handleInputChange = (e) => {
        setMessage(e.target.value);
    };

    // ------------------- 渲染逻辑 -------------------

    if (!isLoggedIn) {
        return (
            <div style={{ ...simpleStyles.container, justifyContent: 'flex-start', paddingTop: '100px' }}>
                <Head>
                    <title>加入聊天室</title>
                </Head>
                <div style={{ width: '350px', padding: '30px', border: '1px solid #ddd', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h1 style={simpleStyles.title}>AI 智能聊天室</h1>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input
                            type="text"
                            placeholder="输入房间号 (例如: 1)"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '1rem' }}
                        />
                        <input
                            type="text"
                            placeholder="输入您的昵称 (例如: Didy)"
                            value={sender}
                            onChange={(e) => setSender(e.target.value)}
                            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '1rem' }}
                        />
                        <input
                            type="text"
                            placeholder={`AI 当前角色名 (例如: ${AI_SENDER_NAME})`}
                            value={aiRole}
                            onChange={(e) => setAiRole(e.target.value)}
                            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '1rem' }}
                        />
                        {error && <div style={simpleStyles.errorBox}>{error}</div>}
                        <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem' }}>
                            加入房间
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>房间 {room} - {sender}</title>
            </Head>

            <div style={simpleStyles.main} className="main-layout">
                <div style={simpleStyles.chatContainer} className="chat-container">
                    <h1 style={simpleStyles.title}>
                        房间 <span style={{ color: '#0070f3' }}>{room}</span>
                        <span style={{ fontSize: '1.2rem', marginLeft: '20px', fontWeight: 'normal', color: '#666' }}>
                            (昵称: {sender}, AI 角色: {aiRole})
                        </span>
                    </h1>
                    
                    {error && <div style={simpleStyles.errorBox}>{error}</div>}

                    {/* 消息历史区域 */}
                    <div style={simpleStyles.chatArea} ref={chatAreaRef} className="chat-area">
                        {chatHistory && chatHistory.map((msg, index) => {
                            // 动态计算样式和对齐
                            const isCurrentUser = msg.sender === sender;
                            const isAI = msg.sender === AI_SENDER_NAME;

                            let dynamicStyle;

                            if (isCurrentUser) {
                                // 自己的消息：蓝色背景，靠右
                                dynamicStyle = { 
                                    backgroundColor: '#0070f3', 
                                    color: 'white', 
                                    float: 'right', 
                                    marginLeft: 'auto', 
                                    borderBottomRightRadius: '2px', // 尖角在右
                                }; 
                            } else {
                                // AI 或其他用户的消息：调用颜色函数，靠左
                                dynamicStyle = getUserColor(msg.sender, onlineMembers); 
                            }

                            return (
                                <div key={index} style={{
                                    ...simpleStyles.messageContainer,
                                    ...dynamicStyle, // 应用动态样式
                                }}
                                className="message-container" 
                                >
                                    {/* 非自己的消息，显示发送者名称 */}
                                    {!isCurrentUser && 
                                        <strong style={{ 
                                            display: 'block', 
                                            marginBottom: '5px', 
                                            // AI (白色背景) 用蓝色字体，其他用户 (彩色背景) 用白色字体
                                            color: isAI ? '#0070f3' : (dynamicStyle.color === 'white' ? 'white' : '#333') 
                                        }}>
                                            {msg.sender}:
                                        </strong>
                                    }
                                    
                                    <div style={{ wordWrap: 'break-word', marginTop: isCurrentUser ? '0' : '5px' }}>
                                        <ReactMarkdown 
                                            children={msg.message} 
                                            remarkPlugins={[remarkGfm]} 
                                            components={markdownComponents} 
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 输入区域 */}
                    <form onSubmit={handleSend} style={simpleStyles.inputArea}>
                        <input
                            type="text"
                            placeholder="输入消息，@万能助理 提问，或 /设定角色 [新角色描述]"
                            value={message}
                            onChange={handleInputChange} 
                            disabled={isSending || !!error}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending || !!error} style={simpleStyles.sendButton}>
                            {isSending ? '发送中...' : '发送'}
                        </button>
                    </form>

                    <div style={{ marginTop: '15px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#666' }}>
                        <p style={{ margin: 0, lineHeight: '1.6' }}>
                            * AI 仅在被 @ 时回复 (例如: @{AI_SENDER_NAME} 你好)
                            <br/>
                            * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={clearHistory} disabled={isSending || !!error} style={{ 
                                padding: '8px 15px', 
                                backgroundColor: '#f44336', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '5px', 
                                cursor: 'pointer' 
                            }}>
                                清空对话
                            </button>
                            <button onClick={exportHistory} disabled={isSending || !!error} style={{ 
                                padding: '8px 15px', 
                                backgroundColor: '#2196f3', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '5px', 
                                cursor: 'pointer' 
                            }}>
                                导出 HTML
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧在线成员列表 */}
                <div style={simpleStyles.memberListContainer} className="member-list-container">
                    <strong>在线成员</strong>
                    <hr/>
                    {onlineMembers.length > 0 ? (
                        onlineMembers.map((member, index) => {
                            const isCurrentUser = member === sender;
                            const isAI = member === AI_SENDER_NAME;
                            const statusColor = isCurrentUser ? '#0070f3' : (isAI ? '#4CAF50' : '#333');
                            const displayName = member; 

                            return (
                                <div key={index} style={{ marginBottom: '5px', color: statusColor, fontWeight: isCurrentUser ? 'bold' : 'normal' }}>
                                    {displayName} {isCurrentUser ? '(你)' : isAI ? '(AI)' : ''}
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ color: '#aaa', fontSize: '0.9rem' }}>正在加载或无其他成员...</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// EOF