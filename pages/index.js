import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// --- 样式定义 ---
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    textAlign: 'center',
    borderBottom: '2px solid #333',
    paddingBottom: '10px',
    marginBottom: '20px',
  },
  chatWindow: {
    height: '400px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '10px',
    overflowY: 'scroll',
    marginBottom: '10px',
    backgroundColor: '#f9f9f9',
  },
  message: {
    marginBottom: '10px',
    padding: '8px',
    borderRadius: '15px',
    maxWidth: '70%',
  },
  userMessage: {
    backgroundColor: '#007bff',
    color: 'white',
    marginLeft: 'auto',
    textAlign: 'right',
  },
  aiMessage: {
    backgroundColor: '#e9ecef',
    color: '#333',
    textAlign: 'left',
  },
  systemMessage: {
    textAlign: 'center',
    color: '#dc3545',
    marginBottom: '10px',
  },
  inputArea: {
    display: 'flex',
  },
  input: {
    flexGrow: 1,
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px 0 0 4px',
  },
  button: {
    padding: '10px 15px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '0 4px 4px 0',
    cursor: 'pointer',
  },
  userList: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '200px',
    border: '1px solid #ccc',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  userItem: {
    marginBottom: '5px',
    fontWeight: 'bold',
    color: '#007bff',
  },
};
// --- 组件开始 ---

const aiRole = "环球智囊"; // 定义 AI 的角色名称
const room = "1"; // 定义房间号
const fixedSender = "shane"; // 定义用户名称

export default function ChatRoom() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatWindowRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  // 初始化：加载历史消息
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/history?room=${room}`);
        if (!res.ok) {
          throw new Error('网络连接错误或服务器失败。');
        }
        const data = await res.json();
        setMessages([
          { role: 'system', message: `欢迎 ${fixedSender} 加入房间 ${room}。AI 角色: **${aiRole}**。` },
          ...data.messages,
        ]);
      } catch (error) {
        setMessages([
          { role: 'system', message: `无法加载聊天历史，请检查后端配置和网络连接。` },
          { role: 'system', message: `欢迎 ${fixedSender} 加入房间 ${room}。我是 ${aiRole}，很高兴为您规划旅行！` },
        ]);
        console.error('Error loading history:', error);
      }
    }
    loadHistory();
  }, []);

  // 处理消息发送
  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = { role: 'user', message: inputMessage.trim(), sender: fixedSender };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: room, // <--- 关键字段
          sender: fixedSender, // <--- 关键字段
          message: inputMessage.trim(), // <--- 关键字段
          aiRole: aiRole, // <--- 关键字段
        }),
      });

      if (!res.ok) {
        // 尝试解析服务器返回的错误消息
        const errorData = await res.json().catch(() => ({ message: '未知错误' }));
        throw new Error(`API 请求失败: ${errorData.message}`);
      }

      const data = await res.json();
      const aiMsg = { role: 'assistant', message: data.aiResponse, sender: aiRole };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error('Error sending message:', error);
      // 显示系统提示失败信息
      setMessages(prev => [...prev, {
        role: 'system',
        message: `发送失败，请稍后重试。原因: ${error.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      <Head>
        <title>双人 AI 旅行规划聊天室</title>
      </Head>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1>
            <span role="img" aria-label="user">👤</span>
            <span role="img" aria-label="ai">🤖</span>
            {" "}双人 AI 旅行规划聊天室
          </h1>
          <p>当前房间: {room} | AI 角色: **{aiRole}** ({fixedSender})</p>
        </header>

        {/* 成员列表 (简化版) */}
        <div style={styles.userList}>
          <h4>在线成员</h4>
          <p style={styles.userItem}>{fixedSender} (你)</p>
          <p style={{ ...styles.userItem, color: '#28a745' }}>{aiRole} (AI)</p>
        </div>

        {/* 聊天窗口 */}
        <div style={styles.chatWindow} ref={chatWindowRef}>
          {messages.map((msg, index) => {
            if (msg.role === 'system') {
              return (
                <div key={index} style={styles.systemMessage}>
                  系统提示: {msg.message}
                </div>
              );
            }
            // 正常消息
            const isUser = msg.sender === fixedSender;
            return (
              <div
                key={index}
                style={{
                  ...styles.message,
                  ...(isUser ? styles.userMessage : styles.aiMessage),
                }}
              >
                <strong>{msg.sender}:</strong> {msg.message}
              </div>
            );
          })}
          {isLoading && (
            <div style={{ ...styles.message, ...styles.aiMessage }}>
              <strong>{aiRole}:</strong> 正在思考...
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div style={styles.inputArea}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的信息..."
            style={styles.input}
            disabled={isLoading}
          />
          <button onClick={handleSend} style={styles.button} disabled={isLoading}>
            {isLoading ? '发送中' : '发送'}
          </button>
        </div>
      </div>
    </>
  );
}