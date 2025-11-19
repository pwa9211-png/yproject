// ... (顶部导入部分保持不变)

// 聊天室的主组件
export default function Home() {
    // ... (其他 useState 变量保持不变)

    // *** 关键修改点 1：默认 AI 角色 ***
    // 将 '环球智囊' 改为更通用的名称，例如 '万能助理'
    const aiRole = '**万能助理**'; 
    // ...

    return (
        <div className={styles.container}>
            <Head>
                {/* *** 关键修改点 2：网页标题 *** */}
                <title>多人 AI 智能聊天室</title> 
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                {/* *** 关键修改点 3：页面横幅标题 *** */}
                <h1 className={styles.title}>
                    <span role="img" aria-label="robot">🤖</span>
                    <span role="img" aria-label="person">🧑‍💻</span> 
                    多人 AI 智能聊天室
                </h1>
                
                {/* ... (其他 JSX 元素保持不变) */}
            </main>
            {/* ... (组件末尾保持不变) */}
        </div>
    );
}