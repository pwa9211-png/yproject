// pages/index.js

import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Home.module.css'; // 确保导入

// (如果使用了 ReactMarkdown，确保导入它)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Home() {
    // 默认 AI 角色 (已修改为万能助理)
    const aiRole = '**万能助理**'; 
    
    // ... (其他 useState 和 useEffect 逻辑)

    return (
        <div className={styles.container}> {/* 🚨 错误可能发生在这里 */}
            <Head>
                <title>多人 AI 智能聊天室</title> 
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>
                    <span role="img" aria-label="robot">🤖</span>
                    <span role="img" aria-label="person">🧑‍💻</span> 
                    多人 AI 智能聊天室
                </h1>
                
                {/* ... (其他 JSX 元素) */}
            </main>
        </div>
    );
}