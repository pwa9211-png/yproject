// pages/index.js
import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- 权限常量定义 (必须与后端文件保持一致) ---
const RESTRICTED_ROOM = '2';
const ALLOWED_USERS = ['Didy', 'Shane'];
const AI_SENDER_NAME = '万能助理';
// ------------------------------------------

// 简单的 Markdown 渲染组件
const markdownComponents = {
    // 渲染块引用为聊天框中的提示框
    blockquote: ({ node, ...props }) => (
        <div style={{ padding: '8px', borderLeft: '3px solid #0070f3', backgroundColor: '#e6f7ff', margin: '10px 0', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#333' }} {...props} />
        </div>
    ),
    // 渲染段落
    p: ({ node, ...props }) => <p style={{ margin: '5px 0' }} {...props} />,
    // 渲染代码块
    pre: ({ node, ...props }) => <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', overflowX: 'auto' }} {...props} />,
};


// 定义基础的内联样式 (请确保您的 global.css 存在且被 _app.js 导入)
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
        borderRadius: '8px',
        padding: '15px',
        overflowY: 'auto', // 关键：聊天记录区域自身滚动
        height: '60vh', // 设置固定高度
        marginBottom: '15px',
        backgroundColor: '#f9f9f9',
    },
    messageContainer: {
        marginBottom: '10px',
        padding: '8px 12px',
        borderRadius: '12px',
        maxWidth: '80%',
        wordBreak: 'break-word',
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#0070f3',
        color: 'white',
        marginLeft: 'auto',
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e0e0',
        color: '#333',
        marginRight: 'auto',
    },
    senderName: {
        fontWeight: 'bold',
        fontSize: '0.8rem',
        marginBottom: '3px',
    },
    formContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative', // 用于定位 @ 菜单
    },
    inputGroup: {
        display: 'flex',
        width: '100%',
    },
    textInput: {
        flex: 1,
        padding: '10px',
        fontSize: '1rem',
        border: '1px solid #ccc',
        borderRadius: '4px 0 0 4px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    sendButton: {
        padding: '10px 15px',
        fontSize: '1rem',
        backgroundColor: '#0070f3',
        color: 'white',
        border: '1px solid #0070f3',
        borderRadius: '0 4px 4px 0',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    memberListContainer: {
        width: '200px',
        padding: '15px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
    },
    atMenu: {
        position: 'absolute',
        bottom: '40px', // 向上定位在输入框上方
        left: '0',
        width: 'calc(100% - 100px)', // 配合输入框宽度
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 10,
        maxHeight: '200px',
        overflowY: 'auto',
        textAlign: 'left',
    },
    atMenuItem: {
        padding: '8px 10px',
        cursor: 'pointer',
        backgroundColor: 'white',
    },
    atMenuItemHover: {
        backgroundColor: '#f0f0f0',
    }
};

// 主要组件
export default function Home() {
    // 状态定义
    const [sender, setSender] = useState('');
    const [room, setRoom] = useState('');
    const [aiRole, setAiRole] = useState('万能助理');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [isJoined, setIsJoined] = useState(false);
    
    // @ 提及状态
    const [showAtMenu, setShowAtMenu] = useState(false);
    const [filteredMembers, setFilteredMembers] = useState([]);

    // Ref
    const chatAreaRef = useRef(null);
    const inputRef = useRef(null); // 用于输入框获取焦点

    // --- 滚动到底部逻辑 ---
    const scrollToBottom = useCallback(() => {
        if (chatAreaRef.current) {
            // 使用 behavior: 'smooth' 增加平滑效果
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        // 在消息更新后滚动到底部
        scrollToBottom();
    }, [messages, scrollToBottom]);


    // --- 1. 心跳和在线成员更新 ---
    const updateHeartbeat = useCallback(async (currentRoom, currentSender) => {
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
    }, []);

    const fetchOnlineMembers = useCallback(async (currentRoom, currentSender) => {
        if (!currentRoom || !currentSender) return;
        try {
            const res = await fetch(`/api/online-status?room=${currentRoom}&sender=${currentSender}`);
            const data = await res.json();
            if (data.success) {
                // 确保 AI 角色始终显示在列表中
                const members = data.members;
                if (!members.includes(AI_SENDER_NAME)) {
                    members.push(AI_SENDER_NAME);
                }
                setOnlineMembers(members.sort()); // 排序后显示
            } else {
                console.error('Error fetching members:', data.message);
                // 处理权限拒绝的情况，例如：如果被踢出房间
                if (res.status === 403) {
                    setIsJoined(false);
                    alert(data.message);
                }
            }
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    }, []);


    // --- 2. 消息轮询和历史记录获取 ---
    const fetchHistoryAndStartPolling = useCallback(async (currentRoom, currentSender) => {
        try {
            // 首次加载历史记录
            const res = await fetch(`/api/history?room=${currentRoom}&sender=${currentSender}`);
            const data = await res.json();

            if (data.success) {
                // 将 MongoDB 返回的 { sender, message, role, timestamp } 转换为前端格式
                const formattedMessages = data.history.map(msg => ({
                    sender: msg.sender,
                    text: msg.message,
                    role: msg.role,
                }));
                setMessages(formattedMessages);
            } else {
                alert(`获取历史记录失败：${data.message}`);
                // 如果是权限问题，则退出
                if (res.status === 403) {
                    setIsJoined(false);
                }
                console.error('Error fetching history:', data.message);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }

        // 启动心跳和在线成员更新的定时器
        const heartbeatInterval = setInterval(() => updateHeartbeat(currentRoom, currentSender), 30000); // 30s 心跳
        const membersInterval = setInterval(() => fetchOnlineMembers(currentRoom, currentSender), 10000); // 10s 更新在线成员

        return () => {
            clearInterval(heartbeatInterval);
            clearInterval(membersInterval);
        };
    }, [updateHeartbeat, fetchOnlineMembers]);


    // --- 3. 加入房间逻辑 ---
    const handleJoin = async () => {
        if (!sender.trim() || !room.trim()) {
            alert('昵称和房间号不能为空！');
            return;
        }

        // 权限检查
        if (room === RESTRICTED_ROOM && !ALLOWED_USERS.includes(sender)) {
            alert(`房间 ${RESTRICTED_ROOM} 是限制房间，您的昵称 ${sender} 不被允许进入。`);
            setSender('');
            return;
        }

        setIsJoined(true);
        // 立即发送心跳并获取历史
        await updateHeartbeat(room, sender);
        fetchHistoryAndStartPolling(room, sender);

        // 设置 AI 角色，方便 /设定角色 命令使用
        setAiRole(AI_SENDER_NAME); 
        // 自动将焦点设置到输入框
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // --- 4. 消息发送逻辑 ---
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const msg = inputMessage.trim();
        if (!msg || isSending) return;

        setIsSending(true);
        setInputMessage(''); // 立即清空输入框
        setShowAtMenu(false); // 隐藏 @ 菜单

        // 临时显示用户发送的消息
        const tempUserMessage = { sender, text: msg, role: 'user', timestamp: new Date() };
        setMessages(prev => [...prev, tempUserMessage]);
        
        // 检查是否是 /设定角色 命令
        const roleCommandMatch = msg.match(/^\/设定角色\s+(.+)/);
        if (roleCommandMatch) {
            const newRole = roleCommandMatch[1].trim();
            setAiRole(newRole);
            setMessages(prev => [...prev, {
                sender: AI_SENDER_NAME,
                text: `角色设定成功。我的新身份是：**${newRole}**。`,
                role: 'model'
            }]);
            setIsSending(false);
            return;
        }

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, sender, message: msg, aiRole }),
            });

            const data = await res.json();

            if (data.success && data.ai_reply && data.ai_reply !== 'AI 未被 @，不回复。') {
                // 如果 AI 回复了，将 AI 的回复加入列表
                const aiMessage = { 
                    sender: AI_SENDER_NAME, // 使用常量
                    text: data.ai_reply, 
                    role: 'model',
                    timestamp: new Date() 
                };
                setMessages(prev => [...prev, aiMessage]);
            } else if (data.success) {
                // 仅保存用户消息，AI 没有被 @
            } else if (res.status === 403) {
                 alert(`发送失败：${data.message}`);
                 setIsJoined(false); // 拒绝后退出
            } else {
                console.error('Chat API Error:', data.message);
                alert(`发送失败：${data.message}`);
            }

        } catch (error) {
            console.error('Send message error:', error);
            alert('发送消息失败，请检查网络或后端服务。');
        } finally {
            setIsSending(false);
        }
    };

    // --- 5. @ 提及处理逻辑 (修复闪烁的核心) ---
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputMessage(value);

        // 检查最后一个单词是否是 @ 提及
        const lastWordMatch = value.match(/@(\S*)$/);
        
        if (lastWordMatch) {
            const mentionPart = lastWordMatch[1].toLowerCase();
            
            // 过滤列表：排除自己，排除 AI，排除当前输入
            const membersToMention = onlineMembers.filter(member => 
                member !== sender && 
                member !== AI_SENDER_NAME &&
                member.toLowerCase().startsWith(mentionPart)
            );
            
            // 如果有匹配项，或者至少输入了 @，则显示菜单
            if (membersToMention.length > 0 || value.endsWith('@')) {
                setFilteredMembers(membersToMention);
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
        // 找到最后一个 '@' 及其之后的内容
        const lastAtIndex = currentText.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            // 替换从 '@' 开始到字符串末尾的部分
            const newText = currentText.substring(0, lastAtIndex + 1) + member + ' ';
            setInputMessage(newText);
            setShowAtMenu(false); // 隐藏菜单
            inputRef.current?.focus(); // 重新聚焦输入框
        }
    };

    // --- 6. 导出对话记录功能 ---
    const exportToHtml = () => {
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>聊天记录 - 房间 ${room}</title>
                <style>
                    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
                    .chat-log { display: flex; flex-direction: column; }
                    .message { margin-bottom: 10px; padding: 10px; border-radius: 10px; max-width: 80%; word-break: break-word; }
                    .user { background-color: #0070f3; color: white; align-self: flex-end; margin-left: auto; }
                    .ai { background-color: #e0e0e0; color: #333; align-self: flex-start; margin-right: auto; }
                    .sender { font-weight: bold; font-size: 0.9em; margin-bottom: 5px; }
                    /* Markdown 样式 */
                    code { background-color: #eee; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
                    pre { background-color: #ddd; padding: 10px; border-radius: 5px; overflow-x: auto; }
                    blockquote { border-left: 3px solid #0070f3; padding: 5px 10px; margin: 10px 0; background-color: #e6f7ff; }
                </style>
            </head>
            <body>
                <h1>房间 ${room} 聊天记录</h1>
                <p>导出者: ${sender} | 导出时间: ${new Date().toLocaleString()}</p>
                <div class="chat-log">
                    ${messages.map(msg => `
                        <div class="message ${msg.role === 'model' ? 'ai' : 'user'}">
                            <div class="sender">${msg.sender}</div>
                            <div class="content">${msg.text.replace(/\n/g, '<br/>')}</div>
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_log_room_${room}_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- 7. 清空历史记录功能 ---
    const clearHistory = async () => {
        if (!confirm('确定要清空本房间的所有聊天记录和在线状态吗？此操作不可逆！')) {
            return;
        }

        try {
            const res = await fetch('/api/clear-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room }),
            });

            const data = await res.json();
            
            if (data.success) {
                alert(data.message);
                setMessages([]); // 清空前端显示
                fetchOnlineMembers(room, sender); // 刷新在线列表
            } else {
                alert(`清空失败: ${data.message}`);
            }

        } catch (error) {
            console.error('Clear history error:', error);
            alert('清空历史记录失败，请检查网络或后端服务。');
        }
    };


    // --- 渲染部分 ---

    if (!isJoined) {
        return (
            <div style={simpleStyles.container}>
                <Head><title>加入聊天室</title></Head>
                <h1 style={simpleStyles.title}>👋 双人 AI 聊天室</h1>
                <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>输入信息加入房间</h2>
                    <div style={{ marginBottom: '15px' }}>
                        <input
                            type="text"
                            placeholder="您的昵称 (例如: 小王)"
                            value={sender}
                            onChange={(e) => setSender(e.target.value)}
                            style={{ ...simpleStyles.textInput, width: 'calc(100% - 20px)', borderRadius: '4px' }}
                        />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="text"
                            placeholder="聊天室号码 (例如: 123456)"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            style={{ ...simpleStyles.textInput, width: 'calc(100% - 20px)', borderRadius: '4px' }}
                        />
                    </div>
                    <button onClick={handleJoin} style={{ ...simpleStyles.sendButton, width: '100%', borderRadius: '4px' }}>
                        加入房间
                    </button>
                    <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#666' }}>
                        * AI 昵称为 **{AI_SENDER_NAME}**<br/>
                        * 房间号 **{RESTRICTED_ROOM}** 为限制房间，仅限 {ALLOWED_USERS.join(', ')} 昵称进入。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={simpleStyles.container}>
            <Head><title>房间 {room} - 聊天室</title></Head>

            <h1 style={simpleStyles.title}>房间 {room}</h1>

            <div style={simpleStyles.main} className="main-layout">
                {/* 左侧聊天区域 */}
                <div style={simpleStyles.chatContainer} className="chat-container">

                    {/* 聊天记录显示区 */}
                    <div ref={chatAreaRef} style={simpleStyles.chatArea} className="chat-area">
                        {messages.length > 0 ? (
                            messages.map((msg, index) => (
                                <div
                                    key={index}
                                    style={{
                                        ...simpleStyles.messageContainer,
                                        ...(msg.role === 'model' ? simpleStyles.aiMessage : simpleStyles.userMessage)
                                    }}
                                >
                                    <div style={simpleStyles.senderName}>
                                        {msg.sender === AI_SENDER_NAME ? `${msg.sender} (${aiRole})` : msg.sender}
                                        <span style={{ marginLeft: '5px', fontSize: '0.7rem', opacity: 0.6 }}>
                                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                                        </span>
                                    </div>
                                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', color: '#aaa', marginTop: '50px' }}>
                                暂无消息。开始聊天吧！
                            </div>
                        )}
                    </div>

                    {/* 输入表单 */}
                    <form onSubmit={handleSendMessage} style={simpleStyles.formContainer}>
                        {/* @ 提及菜单 */}
                        {showAtMenu && (
                            <div style={{ ...simpleStyles.atMenu, bottom: '60px' }}>
                                {filteredMembers.map((member) => (
                                    <div
                                        key={member}
                                        style={simpleStyles.atMenuItem}
                                        onMouseDown={(e) => { // 使用 onMouseDown 防止焦点丢失，从而导致菜单立刻消失
                                            e.preventDefault(); 
                                            handleAtMentionClick(member);
                                        }}
                                        onTouchStart={(e) => { // 移动端支持
                                            e.preventDefault(); 
                                            handleAtMentionClick(member);
                                        }}
                                    >
                                        @{member}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={simpleStyles.inputGroup}>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={`消息 (当前 AI 身份: ${aiRole})`}
                                value={inputMessage}
                                onChange={handleInputChange}
                                disabled={isSending}
                                style={simpleStyles.textInput}
                            />
                            <button type="submit" disabled={isSending} style={simpleStyles.sendButton}>
                                {isSending ? '发送中...' : '发送'}
                            </button>
                        </div>
                    </form>

                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666', width: '100%', textAlign: 'center' }}>
                        <p style={{ margin: '5px 0' }}>
                            * **AI 仅在被 @ 时回复** (例如: **@{AI_SENDER_NAME}** 你好)
                        </p>
                        <p style={{ margin: '5px 0' }}>
                            * 使用 `/设定角色 [新角色描述]` 命令可以动态切换 AI 身份。
                        </p>
                        <div style={{ marginTop: '15px' }}>
                             <button onClick={exportToHtml} style={{ marginRight: '10px', padding: '5px 10px', cursor: 'pointer' }}>
                                📥 导出对话记录 (HTML)
                            </button>
                            <button onClick={clearHistory} style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}>
                                🗑️ 清空房间历史
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右侧在线成员列表 */}
                <div style={simpleStyles.memberListContainer} className="member-list-container">
                    <strong>在线成员</strong>
                    <hr/>
                    {onlineMembers.length > 0 ? (
                        onlineMembers.map((member, index) => (
                            <div key={index} style={{ marginBottom: '5px', color: member === sender ? '#0070f3' : member === AI_SENDER_NAME ? '#f44336' : '#333' }}>
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