// lib/ai.js  【调试监听版 - 打印每一次搜索请求与响应】
import { ZhipuAI } from 'zhipuai';

const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
const ZHIPU_MODEL   = 'glm-4';          // 也可换 glm-4-flash 对比
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
 * 联网搜索工具（调试版）
 */
async function performWebSearch(query) {
  console.log('【搜索触发】关键词：', query);

  const body = {
    search_query: query,
    search_engine: 'search_pro',   // 高阶版，结果更稳
    search_intent: false,
    count: 5,
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

    if (!data.search_result || data.search_result.length === 0) {
      console.log('【搜索无果】');
      return `未找到关于“${query}”的最新信息。`;
    }

    // 拼装成简洁文本供模型阅读
    const txt = data.search_result
      .map((it, i) => `${i + 1}. ${it.title}\n   ${it.content}\n   链接：${it.link}`)
      .join('\n\n');
    console.log('【搜索拼装】返回给模型的文本长度：', txt.length);
    return txt;
  } catch (e) {
    console.error('【搜索异常】', e);
    return `搜索异常：${e.message}`;
  }
}

/**
 * 主函数：带工具的对话循环
 */
export async function runChatWithTools(history = []) {
  console.log('[AI] 对话开始，历史消息数：', history.length);

  // 把“强制搜索协议”写进系统提示
  const sysPrompt = `你具备联网搜索能力。对于任何实时性问题（新闻、热搜、股价、天气、今日/最新等），你必须调用 web_search 工具，绝不能靠记忆猜测。
回答时先写“【已联网搜索】”，再给出结果，并在末尾用“信息来源：<链接>”注明来源。`;

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
  while (turns++ < 5) {               // 最多 5 轮防止死循环
    try {
      console.log('[AI] 请求模型 >>> 消息数：', history.length);
      const res = await client.chat.completions.create({
        model       : ZHIPU_MODEL,
        messages    : history,
        tools,
        tool_choice : 'auto',
        temperature : 0,      // 确定性最高
      });

      const choice = res.choices[0];
      console.log('[AI] finish_reason：', choice.finish_reason);
      if (!choice.message) throw new Error('message 为空');

      history.push(choice.message);

      if (choice.finish_reason === 'tool_calls') {
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
        continue; // 继续循环，把工具结果再喂给模型
      }

      if (choice.finish_reason === 'stop') {
        const reply = choice.message.content || '（无内容）';
        console.log('[AI] 最终回复：', reply);
        return reply;
      }

      // 其他情况
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