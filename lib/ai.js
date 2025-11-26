	// lib/ai.js (显微镜版 - 专注排查AI回复)
	import { ZhipuAI } from 'zhipuai';
	const ZHIPU_API_KEY = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY;
	const ZHIPU_MODEL = 'glm-4';
	export async function runChatWithTools(history) {
	    console.log("[显微镜] runChatWithTools 被调用");
	    console.log("[显微镜] 收到的历史消息:", JSON.stringify(history, null, 2));
	    try {
	        if (!ZHIPU_API_KEY) {
	            return "错误：API Key 未设置。";
	        }
	        const aiClient = new ZhipuAI({ apiKey: ZHIPU_API_KEY });
	        console.log("[显微镜] 准备调用Zhipu API...");
	        // *** 核心测试：只发送最简单的对话，不带任何工具 ***
	        const response = await aiClient.chat.completions.create({
	            model: ZHIPU_MODEL,
	            messages: history, // 直接传入完整的历史，包括系统提示
	            // temperature: 0.7, // 暂时注释掉，用默认值
	        });
	        // *** 打印API的完整响应，一个字节都不放过 ***
	        console.log("[显微镜] Zhipu API的完整原始响应:", JSON.stringify(response, null, 2));
	        const choice = response.choices[0];
	        if (!choice) {
	            console.error("[显微镜] 致命错误：API响应中缺少 choices 对象！");
	            return "后端逻辑错误：API响应格式不正确。";
	        }
	        const message = choice.message;
	        if (!message) {
	            console.error("[显微镜] 致命错误：choice中缺少 message 对象！");
	            return "后端逻辑错误：API响应格式不正确。";
	        }
	        // *** 检查 message.content 的内容 ***
	        const finalReply = message.content;
	        console.log("[显微镜] 提取到的 message.content 是:", JSON.stringify(finalReply));
	        if (finalReply === null || finalReply === undefined) {
	            console.error("[显微镜] 致命错误：message.content 是 null 或 undefined！");
	            return "后端逻辑错误：AI没有返回任何内容。";
	        }
	        if (finalReply === '') {
	            console.warn("[显微镜] 警告：message.content 是一个空字符串！");
	            // 我们故意返回一个非空字符串，以便在前端看到区别
	            return "(AI返回了空内容，但这是我们的测试消息)"; 
	        }
	        console.log("[显微镜] 成功获取AI回复:", finalReply);
	        return finalReply;
	    } catch (error) {
	        console.error('[显微镜] API调用过程中抛出异常:', error);
	        return `API调用出错: ${error.message}`;
	    }
	}
	// 兼容导出
	export async function GoogleGenAI(messages, aiRole) {
	    return runChatWithTools(messages);
	}