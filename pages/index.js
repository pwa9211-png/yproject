好的，这是根据您的需求（AI 切换到智谱、新增导出功能、修复滚动条和消息对齐）进行修改后的 **`pages/index.js`** 完整代码。

请用以下代码**替换**您项目中的 `pages/index.js` 文件。

### 📄 `pages/index.js` 完整代码

```javascript
// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (保持不变) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
const AI_SENDER_NAME = '万能助理'; // AI 的昵称
const AI_ROLE_DEFAULT = '万能助理'; // 默认角色
// -------------------

// 用于渲染 Markdown 的组件 (保持不变)
const markdownComponents = {
    // 强制链接在新窗口打开
    a: props => <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>,
    // 代码块样式
    code: ({node, inline, className, children, ...props}) => {
        const match = /language-(\w+)/.exec(className || '')
        return !inline ? (
            <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '5px', 
                overflowX: 'auto',
                border: '1px solid #ddd',
                whiteSpace: 'pre-wrap', // 允许代码换行
                wordBreak: 'break-word',
                fontSize: '0.9em'
            }}>
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        ) : (
            <code className={className} {...props} style={{ 
                backgroundColor: '#eee', 
                padding: '2px 4px', 
                borderRadius: '3px' 
            }}>
                {children}
            </code>
        )
    }
}


// --- 样式定义 (修复问题 3: 滚动条/滚动问题) ---
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
        flex: 3,
        display: 'flex',
        flexDirection: 'column', 
        marginRight: '20px',
        width: '70%', 
        maxWidth: '70%', 
    },
    memberListContainer: {
        flex: 1,
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#f9f9f9',
        minWidth: '200px',
        maxWidth: '25%', 
    },
    // 聊天窗口核心样式：滚动条修复关键
    chatWindow: {
        flex: 1, 
        overflowY: 'auto', // 确保垂直滚动条自动出现
        marginBottom: '10px',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#fff',
        minHeight: '400px', 
        maxHeight: '60vh', // 限制高度以适应屏幕，保证输入框可见
        // 确保聊天容器能撑开
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
    },
    // 聊天控制区（清空/导出按钮）
    chatControls: {
        display: 'flex',
        justifyContent: 'flex-start', 
        marginBottom: '10px',
    },
    clearButton: {
        padding: '8px 15px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    // 消息输入区
    inputArea: {
        display: 'flex',
        marginTop: '10px',
    },
    textInput: {
        flexGrow: 1,
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '5px 0 0 5px',
        fontSize: '1rem',
        minWidth: 0,
    },
    sendButton: {
        padding: '10px 20px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '0 5px 5px 0',
        cursor: 'pointer',
        fontSize: '1rem',
        whiteSpace: 'nowrap',
    },
    // 消息样式 (修复问题 4: 消息对齐)
    messageContainer: {
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '75%',
        marginBottom: '10px',
        padding: '10px',
        borderRadius: '10px',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
    },
    userMessage: {
        backgroundColor: '#e1ffc7',
        alignSelf: 'flex-end', // 用户消息靠右
    },
    otherMessage: {
        backgroundColor: '#f0f0f0',
        alignSelf: 'flex-start', // 其他普通用户消息靠左
    },
    aiMessage: {
        backgroundColor: '#e6f7ff',
        alignSelf: 'flex-start', // AI 消息靠左
    },
    senderName: {
        fontSize: '0.8rem',
        fontWeight: 'bold',
        marginBottom: '4px',
    },
    // 登录界面样式
    loginForm: {
        display: 'flex',
        flexDirection: 'column',
        width: '300px',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fff',
    },
    loginInput: {
        marginBottom: '10px',
        padding: '10px',
        fontSize: '1rem',
        border: '1px solid #ccc',
        borderRadius: '5px',
    },
    loginButton: {
        padding: '10px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '1rem',
    }
};


export default function Home() {
    // --- 状态定义 ---
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [nickname, setNickname] = useState('');
    const [room, setRoom] = useState('1'); // 默认房间号
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [aiRole, setAiRole] = useState(AI_ROLE_DEFAULT);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const chatWindowRef = useRef(null);


    // --- 滚动到底部逻辑 ---
    const scrollToBottom = () => {
        if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
    };

    // --- 消息和成员列表获取逻辑 (保持不变) ---
    const fetchHistory = async () => {
        if (!room || !nickname) return;
        try {
            const response = await fetch(`/api/history?room=${room}&sender=${nickname}`);
            const data = await response.json();
            if (data.success) {
                // 历史记录中的角色通常是 'user' 或 'model'
                setMessages(data.history.map(msg => ({ 
                    sender: msg.sender, 
                    message: msg.message, 
                    timestamp: new Date(msg.timestamp) 
                })));
            } else if (data.message.includes("限制房间")) {
                alert(data.message); // 权限不足的警告
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
    
    // --- Hook ---
    useEffect(() => {
        if (isLoggedIn) {
            fetchHistory();
            fetchOnlineMembers();
            
            // 启动定时器：心跳、刷新历史、刷新在线列表
            const historyInterval = setInterval(fetchHistory, 2000); 
            const statusInterval = setInterval(fetchOnlineMembers, 5000);
            const heartbeatInterval = setInterval(sendHeartbeat, 30000); // 30秒心跳
            
            return () => {
                clearInterval(historyInterval);
                clearInterval(statusInterval);
                clearInterval(heartbeatInterval);
            };
        }
    }, [isLoggedIn, room, nickname]);

    useEffect(() => {
        // 只有当消息列表更新时，才滚动到底部
        if (isLoggedIn) {
            scrollToBottom();
        }
    }, [messages, isLoggedIn]);


    // --- 登录/输入/发送逻辑 (保持不变) ---
    const handleLogin = (e) => {
        e.preventDefault();
        if (nickname.trim() && room.trim()) {
            setIsLoggedIn(true);
            // 登录后立即发送心跳并获取历史，无需等待定时器
            sendHeartbeat();
        } else {
            alert('昵称和房间号不能为空！');
        }
    };

    const handleInputChange = (e) => {
        setInputMessage(e.target.value);
    };
    
    const handleRoomChange = (e) => {
        setRoom(e.target.value);
    };

    const handleNicknameChange = (e) => {
        setNickname(e.target.value);
    };
    
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        setIsSending(true);
        const userMessage = inputMessage;
        setInputMessage(''); // 清空输入框

        // 临时显示用户消息
        setMessages(prev => [...prev, { 
            sender: nickname, 
            message: userMessage, 
            timestamp: new Date() 
        }]);
        
        // 检查角色设定命令
        const roleCommandMatch = userMessage.match(/^\/设定角色\s+(.+)/);
        if (roleCommandMatch) {
            const newRole = roleCommandMatch[1].trim();
            setAiRole(newRole);
            const confirmationMessage = {
                sender: AI_SENDER_NAME, 
                message: `角色设定成功：AI 现在是 **${newRole}**。`, 
                timestamp: new Date()
            };
            // 立即更新角色并显示确认消息
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
                // 如果 API 失败 (如权限问题、AI 错误等)
                console.error('API Error:', data.message || '未知错误');
                alert(`发送失败: ${data.message || '未知错误'}`);
            }
            
            // AI 的回复由 fetchHistory 定时更新，所以这里不再手动添加 AI 消息到 state
            // 只有当 AI 没有回复时（例如未被 @），才直接结束发送状态
            if (data.ai_reply && data.ai_reply.includes('AI 未被 @')) {
                // do nothing
            }

        } catch (error) {
            console.error('发送消息失败:', error);
            alert('网络或服务器错误，发送失败。');
        } finally {
            setIsSending(false);
            // fetchHistory 会处理最终的消息更新
        }
    };
    
    // --- 清空历史记录逻辑 ---
    const handleClearHistory = async () => {
        if (!window.confirm('确定要清空本房间的所有聊天记录和在线状态吗？此操作不可逆！')) {
            return;
        }

        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });

            if (response.ok) {
                setMessages([]);
                setOnlineMembers([AI_SENDER_NAME]); // 清空后只保留 AI
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

    // --- 新增：HTML 导出功能函数 (修复问题 1: HTML 导出) ---
    const handleExportHistory = async () => {
        if (!room || !nickname) { 
            alert("请先登录房间！");
            return;
        }

        try {
            const response = await fetch(`/api/export-history?room=${room}&sender=${nickname}`); 
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `chat_export_${room}_${new Date().toISOString().slice(0, 10)}.html`;
                if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
                    filename = contentDisposition.split('filename=')[1].replace(/"/g, '').split(';')[0];
                }
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    alert(`导出失败: ${errorData.message || '未知错误'}`);
                } catch (e) {
                    alert(`导出失败: ${errorText || response.statusText}`);
                }
            }
        } catch (error) {
            console.error('Export History Error:', error);
            alert('导出请求失败。请检查网络连接或后端服务。');
        }
    };


    // ---------------------------------------------------
    // --- 消息渲染部分 (修复问题 4: 消息对齐) ---
    // ---------------------------------------------------
    const renderChatMessages = () => {
        return messages.map((msg, index) => {
            const isCurrentUser = msg.sender === nickname;
            // 确保 AI 的昵称处理是正确的
            const isAI = msg.sender.replace(/\*/g, '') === AI_SENDER_NAME.replace(/\*/g, ''); 

            const style = isCurrentUser 
                ? simpleStyles.userMessage 
                : isAI
                    ? simpleStyles.aiMessage
                    : simpleStyles.otherMessage; // 其他用户消息靠左
            
            const senderStyle = isCurrentUser 
                ? { textAlign: 'right', color: '#075e54' } 
                : { textAlign: 'left', color: isAI ? '#0070f3' : '#333' }; // 区分 AI 颜色

            return (
                <div 
                    key={index} 
                    style={{ 
                        ...simpleStyles.messageContainer, 
                        ...style 
                    }}
                >
                    <div style={{ ...simpleStyles.senderName, ...senderStyle }}>
                        {msg.sender} 
                        <span style={{ fontWeight: 'normal', fontSize: '0.8em', marginLeft: '8px', color: '#888' }}> 
                            {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    {/* 使用 ReactMarkdown 渲染消息内容 */}
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                        {msg.message}
                    </ReactMarkdown>
                </div>
            );
        });
    };
    // ---------------------------------------------------

    // --- 未登录界面 ---
    if (!isLoggedIn) {
        return (
            <div style={{...simpleStyles.container, justifyContent: 'flex-start', paddingTop: '100px'}}>
                <Head>
                    <title>AI 聊天室 - 登录</title>
                </Head>
                <h1 style={simpleStyles.title}>AI 聊天室</h1>
                <form onSubmit={handleLogin} style={simpleStyles.loginForm}>
                    <h2>加入房间</h2>
                    <input 
                        type="text" 
                        placeholder="输入您的昵称 (例如: 小王)" 
                        value={nickname}
                        onChange={handleNicknameChange}
                        style={simpleStyles.loginInput}
                        required
                    />
                    <input 
                        type="text" 
                        placeholder="输入房间号 (例如: 1)" 
                        value={room}
                        onChange={handleRoomChange}
                        style={simpleStyles.loginInput}
                        required
                    />
                    <button type="submit" style={simpleStyles.loginButton}>
                        登录 / 加入房间 {room}
                    </button>
                    <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#999', textAlign: 'center' }}>
                         AI 角色默认是 "{AI_ROLE_DEFAULT}"
                    </p>
                </form>
            </div>
        );
    }
    
    // --- 聊天界面 ---
    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>AI 聊天室 - 房间 {room}</title>
            </Head>
            
            <h1 style={simpleStyles.title}>AI 聊天室 - 房间 {room} (AI 角色: {aiRole})</h1>

            <div style={simpleStyles.main} className="main-layout">
                {/* 左侧聊天主区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    
                    {/* 聊天控制区 (新增导出按钮) */}
                    <div style={simpleStyles.chatControls}>
                        <button onClick={handleClearHistory} style={simpleStyles.clearButton}>
                            清空历史记录
                        </button>
                        <button 
                            onClick={handleExportHistory} 
                            style={{...simpleStyles.clearButton, marginLeft: '10px', backgroundColor: '#28a745'}}
                        >
                            导出历史记录 (.html)
                        </button>
                    </div>

                    {/* 聊天窗口 (修复滚动条问题) */}
                    <div ref={chatWindowRef} style={simpleStyles.chatWindow} className="chat-window">
                        {messages.length > 0 ? (
                            renderChatMessages()
                        ) : (
                            <div style={{ color: '#aaa', textAlign: 'center', marginTop: '50px' }}>
                                暂无消息。发送第一条消息开始聊天吧！
                            </div>
                        )}
                    </div>
                    
                    {/* 消息输入框 */}
                    <form onSubmit={handleSendMessage} style={simpleStyles.inputArea}>
                        <input
                            type="text"
                            placeholder="输入消息，@万能助理 提问，或 /设定角色 [新角色] 切换AI身份..."
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
                            <div key={index} style={{ marginBottom: '5px', color: member === nickname ? '#0070f3' : (member === AI_SENDER_NAME ? '#075e54' : '#333'), fontWeight: member === nickname || member === AI_SENDER_NAME ? 'bold' : 'normal' }}>
                                {member} {member === nickname ? '(你)' : member === AI_SENDER_NAME ? `(AI - ${aiRole})` : ''}
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
```