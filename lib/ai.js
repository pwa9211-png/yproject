// lib/ai.js  【实时行情+系统时间版-2025-11-26】
import { ZhipuAI } from 'zhipuai';

const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
const ZHIPU_MODEL   = 'glm-4';
const SEARCH_URL    = 'https://open.bigmodel.cn/api/paas/v4/web_search';

let client;
try {
  if (!ZHIPU_API_KEY) throw new Error('环境变量 GLM_API_KEY 未设置');
  client = new ZhipuAI({ apiKey: ZHIPU_API_KEY });
  console.log('[AI] ZhipuAI SDK 初始化成功，模型：' + ZHIPU_MODEL);
} catch (e) {
  console.error('[AI] 初始化失败：', e.message);
}

/**
 * 联网搜索工具（行情/热搜等网页内容）
 */
export async function performWebSearch(query) {
  console.log('【搜索触发】关键词：', query);
  const body = {
    search_query: query,
    search_engine: 'search_pro',
    search_intent: false,
    count: 3,
    search_recency_filter: 'oneDay',
    content_size: 'high',
    search_domain_filter: 'quote.eastmoney.com,sinajs.cn,time.tianqi.com',
  };
  console.log('【搜索请求】body：', JSON.stringify(body, null, 2));
  try {
    const res = await fetch(SEARCH_URL, {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
        'Content-Type' : 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('【搜索失败】HTTP', res.status, err);
      return `搜索失败（HTTP ${res.status}）：${JSON.stringify(err)}`;
    }
    const data = await res.json();
    console.log('【搜索返回】原始数据：', JSON.stringify(data, null, 2));
    if (data.search_intent && data.search_intent.length) {
      console.log('【搜索意图】', JSON.stringify(data.search_intent, null, 2));
    }
    if (!data.search_result || data.search_result.length === 0) {
      console.log('【搜索无果】');
      return `未找到关于“${query}”的今天最新信息。`;
    }
    const txt = data.search_result
      .filter((it, i, arr) => arr.findIndex(x => x.link === it.link) === i)
      .slice(0, 3)
      .map((it, i) =>
        `${i + 1}. ${it.title}\n   ${it.content.replace(/<br\s*\/?>/g, '\n')}\n   链接：${it.link}`
      )
      .join('\n\n');
    console.log('【搜索拼装】返回给模型的文本长度：', txt.length);
    return txt;
  } catch (e) {
    console.error('【搜索异常】', e);
    return `搜索异常：${e.message}`;
  }
}

/**
 * 直连新浪行情（上证指数 JSON）
 * 返回：{ price, change, changePercent, source }
 */
export async function fetchSZZS() {
  const url = 'https://hq.sinajs.cn/list=s_sh000001';
  try {
    const res = await fetch(url, { headers: { Referer: 'https://finance.sina.com.cn' } });
    if (!res.ok) throw new Error(`新浪行情HTTP ${res.status}`);
    const txt = await res.text(); // var hq_str_s_sh000001="上证指数,3864.18,-5.84,-0.15,...
    const [, price, change, changePercent] = txt.match(/="([^,]+),([^,]+),([^,]+),([^,]+),/) || [];
    if (!price) throw new Error('解析失败');
    return {
      price,
      change,
      changePercent,
      source: 'https://hq.sinajs.cn/list=s_sh000001'
    };
  } catch (e) {
    console.error('【行情异常】', e);
    return null;
  }
}

/**
 * 主函数：带工具的对话循环（强制调用 web_search）
 */
export async function runChatWithTools(history = []) {
  console.log('[AI] 对话开始，历史消息数：', history.length);
  const sysPrompt = `
你是“万能助理”，只能基于实时联网结果回答。
规则：
1. 任何涉及“今天/现在/最新/热搜/股价/天气”等问题 → 必须调用 web_search，否则视为违规。
2. 先写“【已联网】”，再给出结果，末尾附“来源：<链接>”。
3. 禁止用旧知识，禁止空回复。
`;
  if (history[0]?.role === 'system') history[0].content = sysPrompt;
  else history.unshift({ role: 'system', content: sysPrompt });
  const tools = [{
    type: 'function',
    function: {
      name        : 'web_search',
      description : '获取实时、最新的网络信息',
      parameters  : {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  }];
  let turns = 0;
  while (turns++ < 5) {
    try {
      console.log('[AI] 请求模型 >>> 消息数：', history.length);
      const res = await client.chat.completions.create({
        model       : ZHIPU_MODEL,
        messages    : history,
        tools,
        tool_choice : { type: 'function', function: { name: 'web_search' } },
        temperature : 0,
      });
      const choice = res.choices[0];
      console.log('[AI] 原始响应 message：', JSON.stringify(choice.message, null, 2));
      console.log('[AI] finish_reason：', choice.finish_reason);
      if (!choice.message) throw new Error('message 为空');
      history.push(choice.message);
      if (choice.finish_reason === 'tool_calls') {
        console.log('[AI] tool_calls 详情：', JSON.stringify(choice.message.tool_calls, null, 2));
        for (const call of choice.message.tool_calls) {
          if (call.function.name === 'web_search') {
            const { query } = JSON.parse(call.function.arguments);
            const searchRes = await performWebSearch(query);
            history.push({
              role        : 'tool',
              tool_call_id: call.id,
              name        : 'web_search',
              content     : searchRes,
            });
          }
        }
        continue;
      }
      if (choice.finish_reason === 'stop') {
        const reply = choice.message.content || '';
        console.log('[AI] 最终回复内容：', reply);
        return reply || '（模型返回空内容）';
      }
      return `对话中断：${choice.finish_reason}`;
    } catch (e) {
      console.error('[AI] 调用异常：', e);
      if (turns >= 5) return '服务多次调用失败，请稍后再试';
    }
  }
  return '对话轮次超限';
}

/* 兼容旧命名导出 */
export async function GoogleGenAI(messages) {
  return runChatWithTools(messages);
}