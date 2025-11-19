// pages/index.js

import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
// import styles from '../styles/Home.module.css';  <-- 确保这一行被移除！

// 引入 ReactMarkdown 和 remarkGfm (如果您的代码中有使用)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Home() {
    // 默认 AI 角色 
    const aiRole = '**万能助理**'; 
    
    // ... (其他 useState 和 useEffect 逻辑)

    return (
        // 使用普通字符串，避免 ReferenceError: styles
        <div className="container"> 
            <Head>
                <title>多人 AI 智能聊天室</title> 
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className="main">
                <h1 className="title">
                    <span role="img" aria-label="robot">🤖</span>
                    <span role="img" aria-label="person">🧑‍💻</span> 
                    多人 AI 智能聊天室
                </h1>
                
                {/* ... (其他 JSX 元素) */}
            </main>
        </div>
    );
}