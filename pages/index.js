// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane']; 
// 🚨 修复点 #2: AI 的默认昵称改为常量，但运行时使用 state (aiRole)
const DEFAULT_AI_SENDER_NAME = '万能助理'; 
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
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        minWidth: '500px',
        maxWidth: '800px', 
    },
    memberListContainer: {
        width: '200px',
        marginLeft: '20px',
        padding: '20px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: '20px',
    },
    chatArea: {
        height: '400px',
        overflowY: 'auto',
        marginBottom: '20px',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#ece5dd', // 微信/QQ 聊天背景色
        display: 'flex', // 启用 flex 布局
        flexDirection: 'column', // 垂直排列
    },
    // 自己的消息在右边
    myMessage: {
        backgroundColor: '#e1ffc7',
        alignSelf: 'flex-end', // 靠右对齐
        maxWidth: '80%',
        marginBottom: '10px',
        padding: '10px',
        borderRadius: '10px',
        textAlign: 'left', 
        boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
        wordBreak: 'break-word',
    },
    // 其他人（包括 AI）的消息在左边
    otherMessage: {
        backgroundColor: '#ffffff', 
        alignSelf: 'flex-start', // 靠左对齐
        maxWidth: '80%',
        marginBottom: '10px',
        padding: '10px',
        borderRadius: '10px',
        textAlign: 'left', 
        boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
        wordBreak: 'break-word',
    },
    timestamp: {
        fontSize: '0.65rem',
        color: '#888',
        marginTop: '5px',
    },
    inputForm: {
        display: 'flex',
        marginTop: '10px',
    },
    textInput: {
        flex: 1,
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        marginRight: '10px',
        fontSize: '1rem',
    },
    sendButton: {
        padding: '10px 15px',
        fontSize: '1rem',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
    },
    clearButton: {
        padding: '10px 15px',
        fontSize: '1rem',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
    },
    exportButton: {
        padding: '10px 15px',
        fontSize: '1rem',
        backgroundColor: '#6c757d', // 灰色
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        marginLeft: '10px',
        transition: 'background-color 0.3s',
    },
};

const markdownComponents = {
    a: ({node, ...props}) => <a style={{color: '#0070f3', textDecoration: 'underline'}} {...props} target="_blank" rel="noopener noreferrer" />,
    code: ({node, inline, className, children, ...props}) => {
        const match = /language-(\w+)/.exec(className || '')
        return !inline && match ? (
            <pre style={{backgroundColor: '#f4f4f4', padding: '10px', borderRadius: '5px', overflowX: 'auto'}}>
                <code className={className} {...props}>
                    {children}
                </code>
            </pre>
        ) : (
            <code style={{backgroundColor: '#ffffe0', padding: '2px 4px', borderRadius: '3px', color: '#c7254e'}} className={className} {...props}>
                {children}
            </code>
        )
    }
};


export default function Home() {
    const [room, setRoom] = useState('');
    const [sender, setSender] = useState('');
    // 🚨 修复点 #2: 初始状态使用 DEFAULT_AI_SENDER_NAME
    const [aiRole, setAiRole] = useState(DEFAULT_AI_SENDER_NAME); 
    const [isJoined, setIsJoined] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const chatAreaRef = useRef(null);
    const [lastHistoryCount, setLastHistoryCount] = useState(0);

    // 自动滚动到底部
    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messages]);

    // 启动心跳和消息轮询
    useEffect(() => {
        let heartbeatInterval;
        let messagePollingInterval;
        let onlineStatusPollingInterval;

        if (isJoined) {
            // 心跳：每 20 秒发送一次，保持在线状态
            const sendHeartbeat = () => {
                fetch('/api/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, username: sender })
                }).catch(err => console.error('Heartbeat failed:', err));
            };

            // 消息轮询：每 2 秒检查一次新消息
            const fetchHistory = async () => {
                try {
                    const response = await fetch(`/api/history?room=${room}&sender=${sender}`);
                    const data = await response.json();
                    
                    if (!data.success) {
                        console.error("获取历史记录失败:", data.message);
                        if (response.status === 403) {
                            clearInterval(messagePollingInterval);
                            clearInterval(heartbeatInterval);
                            alert(data.message);
                            setIsJoined(false);
                        }
                        return;
                    }
                    
                    const history = data.history || [];
                    
                    if (history.length !== lastHistoryCount) {
                        setMessages(history.map(msg => ({
                            sender: msg.sender,
                            message: msg.message,
                            timestamp: msg.timestamp || new Date(),
                            // 🚨 使用 aiRole 来判断消息的 role
                            role: msg.role || (msg.sender === aiRole ? 'model' : 'user')
                        })));
                        setLastHistoryCount(history.length);
                    }
                } catch (error) {
                    console.error('获取历史消息出错:', error);
                }
            };
            
            // 在线状态轮询：每 10 秒检查一次在线成员
            const fetchOnlineStatus = async () => {
                try {
                    const response = await fetch(`/api/online-status?room=${room}&sender=${sender}`);
                    const data = await response.json();
                    
                    if (data.success) {
                        let members = data.members;
                        // 🚨 修复点 #2: 检查当前的 aiRole 是否在列表中
                        if (!members.includes(aiRole)) {
                            members.push(aiRole);
                        }
                        setOnlineMembers(members.sort());
                    } else if (response.status === 403) {
                        // 🚨 权限拒绝时，显示自己和当前的 aiRole
                        setOnlineMembers([sender, aiRole].sort()); 
                    }
                } catch (error) {
                    console.error('获取在线状态出错:', error);
                }
            };


            sendHeartbeat(); // 首次进入发送心跳
            fetchHistory(); // 首次加载历史
            fetchOnlineStatus(); // 首次加载在线状态
            
            heartbeatInterval = setInterval(sendHeartbeat, 20000); // 20秒心跳
            messagePollingInterval = setInterval(fetchHistory, 2000); // 2秒轮询
            onlineStatusPollingInterval = setInterval(fetchOnlineStatus, 10000); // 10秒轮询
        }

        // 🚨 依赖中加入 aiRole，确保 aiRole 改变时，轮询会重新加载正确的 AI 昵称
        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(messagePollingInterval);
            clearInterval(onlineStatusPollingInterval);
            setLastHistoryCount(0);
        };
    }, [isJoined, room, sender, lastHistoryCount, aiRole]); 


    // 处理加入聊天室
    const handleJoin = (e) => {
        e.preventDefault();
        if (room.trim() && sender.trim()) {
            setIsJoined(true);
        } else {
            alert('房间号和昵称不能为空');
        }
    };

    // 🚨 修复点 #3: 消息输入框的 onChange 处理函数
    const handleInputChange = (e) => {
        const value = e.target.value;
        setMessageInput(value);
        
        // 如果用户只输入了 @，自动填充 AI 角色名称并带一个空格
        if (value === '@') {
            setMessageInput(`@${aiRole} `);
        }
    };

    // 处理消息发送
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const message = messageInput.trim();
        if (!message || isSending || !isJoined) return;

        setIsSending(true);
        setMessageInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender, message, aiRole })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                alert(`发送失败: ${data.message}`);
                setMessageInput(message); 
            }
        } catch (error) {
            console.error('发送消息出错:', error);
            alert('网络错误，发送失败。');
            setMessageInput(message);
        } finally {
            setIsSending(false);
        }
    };
    
    // 处理清空历史记录
    const handleClearHistory = async () => {
        if (!room) {
            alert('请先加入聊天室。');
            return;
        }

        if (!confirm('确定要清除本房间的所有历史记录和在线状态吗？此操作不可逆！')) {
            return;
        }

        try {
            const response = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                setMessages([]);
                setLastHistoryCount(0);
                // 🚨 修复点 #2: 清空后只留下自己和当前的 aiRole
                setOnlineMembers(prev => prev.filter(m => m === sender || m === aiRole)); 
            } else {
                alert(`清空失败: ${data.message}`);
            }
        } catch (error) {
            console.error('清空历史记录出错:', error);
            alert('网络错误，清空失败。');
        }
    };
    
    // 对话导出到 HTML 功能实现
    const handleExportHtml = async () => {
        if (!room) {
            alert('请先加入聊天室。');
            return;
        }

        try {
            const response = await fetch(`/api/history?room=${room}&sender=${sender}`);
            const data = await response.json();
            const history = data.history || [];

            if (history.length === 0) {
                alert('没有对话记录可导出。');
                return;
            }

            let htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>聊天记录导出 - 房间: ${room}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 0 10px; }
        .message-container { margin-bottom: 10px; padding: 10px; border-radius: 8px; max-width: 70%; word-wrap: break-word; line-height: 1.6; }
        .user-message { background-color: #e1ffc7; margin-left: auto; text-align: left; }
        .other-message { background-color: #ffffff; margin-right: auto; text-align: left; }
        .sender-name { font-weight: bold; margin-bottom: 5px; font-size: 0.9em; color: #555; }
        .timestamp { font-size: 0.7em; color: #888; margin-top: 5px; display: block; }
    </style>
</head>
<body>
    <h1>聊天记录 - 房间: ${room}</h1>
    <p>导出用户: ${sender} / 导出时间: ${new Date().toLocaleString()}</p>
    <hr/>
    ${history.map(msg => {
        const isMe = msg.sender === sender;
        const className = isMe ? 'user-message' : 'other-message';
        const alignment = isMe ? 'right' : 'left'; 
        
        const timestampStr = new Date(msg.timestamp).toLocaleString();
        
        const content = msg.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

        return `
            <div class="message-container ${className}" style="float: ${alignment}; clear: both;">
                <div class="sender-name" style="text-align: ${alignment === 'right' ? 'right' : 'left'}; color: ${isMe ? '#075e54' : '#000'};">
                    ${msg.sender}
                </div>
                <div>${content}</div>
                <div class="timestamp" style="text-align: ${alignment === 'right' ? 'right' : 'left'};">${timestampStr}</div>
            </div>
        `;
    }).join('\n')}
    <div style="clear: both;"></div>
</body>
</html>`;

            // 3. 创建并下载文件
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat_export_${room}_${new Date().toISOString().slice(0, 10)}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('导出对话失败:', error);
            alert('导出对话失败，请查看控制台。');
        }
    };


    if (!isJoined) {
        return (
            <div style={simpleStyles.container}>
                <Head>
                    <title>AI 聊天室 - 加入</title>
                </Head>
                <main>
                    <h1 style={simpleStyles.title}>加入 AI 聊天室</h1>
                    <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
                        <input
                            type="text"
                            placeholder="输入您的昵称 (例如: 小王)"
                            value={sender}
                            onChange={(e) => setSender(e.target.value)}
                            style={simpleStyles.textInput}
                        />
                        <input
                            type="text"
                            placeholder="输入聊天室号码 (例如: 123456)"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            style={simpleStyles.textInput}
                        />
                        <input
                            type="text"
                            // 🚨 使用 DEFAULT_AI_SENDER_NAME 进行提示
                            placeholder={`设置 AI 角色 (当前: ${DEFAULT_AI_SENDER_NAME})`}
                            // 如果用户输入框为空，则使用默认角色
                            value={aiRole === DEFAULT_AI_SENDER_NAME ? '' : aiRole}
                            onChange={(e) => setAiRole(e.target.value.trim() || DEFAULT_AI_SENDER_NAME)}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" style={simpleStyles.sendButton}>
                            加入聊天室
                        </button>
                    </form>
                    <p style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666' }}>
                        提示：如果不设置 AI 角色，默认为 `{DEFAULT_AI_SENDER_NAME}`。
                    </p>
                </main>
            </div>
        );
    }

    return (
        <div style={simpleStyles.container}>
            <Head>
                <title>AI 聊天室 - 房间 {room}</title>
            </Head>

            <h1 style={simpleStyles.title}>
                房间: {room} ({sender}) - AI 角色: {aiRole}
            </h1>

            <div style={simpleStyles.main} className="main-layout">
                {/* 左侧聊天区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                         <button onClick={() => setIsJoined(false)} style={simpleStyles.clearButton}>
                            退出房间
                        </button>
                        <div>
                            <button onClick={handleClearHistory} style={{...simpleStyles.clearButton, marginLeft: '10px'}} disabled={!room}>
                                清空历史记录
                            </button>
                            <button onClick={handleExportHtml} style={simpleStyles.exportButton} disabled={!room}>
                                导出对话到 HTML
                            </button>
                        </div>
                    </div>
                   
                    {/* 消息展示区 */}
                    <div ref={chatAreaRef} style={simpleStyles.chatArea}>
                        {messages.map((msg, index) => {
                            const isMe = msg.sender === sender;
                            // 🚨 修复点 #2: 使用 aiRole 判断 AI 消息
                            const isAi = msg.sender === aiRole; 
                            const messageStyle = isMe ? simpleStyles.myMessage : simpleStyles.otherMessage;
                            const senderColor = isMe ? '#075e54' : (isAi ? '#1e90ff' : '#000'); 
                            
                            return (
                                <div key={index} style={messageStyle}>
                                    <div style={{ fontWeight: 'bold', color: senderColor, marginBottom: '5px' }}>
                                        {msg.sender}
                                    </div>
                                    <div className="chat-message-content"> 
                                        <ReactMarkdown 
                                            components={markdownComponents} 
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {msg.message}
                                        </ReactMarkdown>
                                    </div>
                                    {/* 消息时间戳 */}
                                    <div style={simpleStyles.timestamp}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 消息输入和发送 */}
                    <form onSubmit={handleSendMessage} style={simpleStyles.inputForm}>
                        <input
                            type="text"
                            placeholder="输入消息..."
                            value={messageInput}
                            // 🚨 修复点 #3: 使用新的处理函数 handleInputChange
                            onChange={handleInputChange} 
                            disabled={isSending}
                            style={simpleStyles.textInput}
                        />
                        <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                            {isSending ? '发送中...' : '发送'}
                        </button>
                    </form>

                    <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
                        * AI 仅在消息中包含 `@${aiRole}` 时回复。
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
                                {/* 🚨 修复点 #2: 使用 aiRole 判断 AI 成员 */}
                                {member} {member === sender ? '(你)' : member === aiRole ? '(AI)' : ''}
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