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
    const lastMessageCountRef = useRef(0); // 用于追踪消息数量变化，避免不必要的滚动
    
    // AI 角色设定为新的通用名称
    const aiRole = `**${AI_SENDER_NAME}**`; 
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    // 仅当消息数量增加时才滚动到底部
    useEffect(() => {
        if (chatHistory.length > lastMessageCountRef.current) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            lastMessageCountRef.current = chatHistory.length;
        }
    }, [chatHistory]);


    // 获取在线成员列表
    const fetchOnlineMembers = async (currentRoom, currentSender) => {
        if (!currentRoom) {
            setOnlineMembers([currentSender, AI_SENDER_NAME]);
            return;
        }

        let membersFromApi = [];
        try {
            const res = await fetch(`/api/online-status?room=${currentRoom}&sender=${currentSender}`);
            const data = await res.json();
            
            if (res.ok && data.members && Array.isArray(data.members)) {
                membersFromApi = data.members.map(m => m.sender);
            }
        } catch (err) {
            console.error("Failed to fetch online members:", err);
        }

        const uniqueMembers = new Set([currentSender, AI_SENDER_NAME, ...membersFromApi]);
        const finalMembers = Array.from(uniqueMembers);
        
        finalMembers.sort((a, b) => {
            if (a === currentSender) return -1;
            if (b === currentSender) return 1;
            return 0;
        });

        setOnlineMembers(finalMembers);
    };

    // 加载历史消息的逻辑
    const fetchHistory = async (currentRoom) => {
        if (!currentRoom) return;
        try {
            const res = await fetch(`/api/history?room=${currentRoom}`);
            const data = await res.json();
            if (res.ok) {
                // 如果后端返回数据，更新聊天记录
                if (data.history) {
                    // 这里可以做一个简单的优化：只有当数据真正变化时才更新 state
                    // 但为了简单起见，我们直接设置，React 会处理 diff
                    setChatHistory(data.history); 
                }
                setError(null);
            } else {
                // 轮询错误通常不弹窗，以免打扰用户，只在控制台记录
                console.error(`Fetch history failed: ${data.message}`);
            }
        } catch (err) {
            console.error(`Fetch history network error: ${err.message}`);
        }
    };

    // 🚨 核心修复：设置心跳、在线状态轮询 AND 聊天记录轮询
    useEffect(() => {
        if (!isLoggedIn) return;

        // 1. 立即执行一次
        fetchOnlineMembers(room, sender);
        fetchHistory(room);

        // 2. 设置定时器
        // 轮询间隔设置为 3 秒，以获得接近实时的体验
        const interval = setInterval(() => {
            fetchOnlineMembers(room, sender);
            fetchHistory(room); 
            
            // 发送心跳 (可选，如果后端没有自动更新)
            fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room, username: sender }),
            }).catch(err => console.error("Heartbeat failed", err));

        }, 3000); 

        return () => clearInterval(interval);
    }, [isLoggedIn, room, sender]); 

    // 登录/加入房间逻辑
    const handleLogin = (