// lib/zsearch.js  【官方 WebSearch 接口封装】
import { ZhipuAI } from 'zhipuai';

const client = new ZhipuAI({ apiKey: process.env.GLM_API_KEY });

/**
 * 强制联网搜索，返回纯文本摘要
 * @param {string} query  要搜的内容
 * @param {number} count  返回条数 1-50
 * @returns {string}      摘要文本
 */
export async function zhipuWebSearch(query, count = 5) {
  try {
    const res = await client.websearch.websearch({
      searchengine: 'searchpro',
      searchquery: query,
      count,
      searchrecencyfilter: 'noLimit',
    });
    return (res.data.items || [])
      .map((it, i) => `${i + 1}. ${it.title} - ${it.url}`)
      .join('\n');
  } catch (e) {
    console.error('[zsearch]', e);
    return '（联网搜索失败）';
  }
}