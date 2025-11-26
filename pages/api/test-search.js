// pages/api/test-search.js
// 这个文件的唯一目的：测试网络搜索功能是否正常

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('[测试接口] 收到请求，开始测试网络搜索...');

    const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
    const ZHIPU_SEARCH_API_URL = 'https://open.bigmodel.cn/api/paas/v4/web_search';

    if (!ZHIPU_API_KEY) {
        console.error('[测试接口] 致命错误：API Key 未配置');
        return res.status(500).json({ success: false, error: '后端配置错误：API Key 未设置' });
    }

    try {
        // 直接调用搜索API，查询“上海今天天气”
        console.log('[测试接口] 正在向智谱AI发起搜索请求...');
        const response = await fetch(ZHIPU_SEARCH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ZHIPU_API_KEY}`
            },
            body: JSON.stringify({
                query: '上海今天天气'
            }),
        });

        console.log('[测试接口] 收到智谱AI的响应，状态码:', response.status);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[测试接口] 搜索API请求失败:', response.status, errorBody);
            return res.status(response.status).json({ 
                success: false, 
                error: `搜索API请求失败 (状态码: ${response.status})`, 
                details: errorBody 
            });
        }

        const data = await response.json();
        console.log('[测试接口] 搜索成功，获取到数据:', JSON.stringify(data, null, 2));

        // 如果一切正常，返回成功和数据
        res.status(200).json({ success: true, data: data });

    } catch (error) {
        console.error('[测试接口] 捕获到异常:', error);
        res.status(500).json({ success: false, error: '搜索时发生未知异常', details: error.message });
    }
}