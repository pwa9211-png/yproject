// test-gemini.js
// 这是一个独立的测试脚本，和网页无关
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 🔴 请在这里填入你的真实 Key，测完记得删除这个文件或清除 Key
const apiKey = "AIzaSyA5VjgKZ9NMScwdCteHLXwz_XOdZKYQ-gU"; 

async function runTest() {
  console.log("1. 开始测试 Google Gemini 连接...");
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 我们使用最新的 flash 模型
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("2. 正在发送消息: '你好，请回复如果你能看到这条消息'...");
    
    const result = await model.generateContent("你好，请回复如果你能看到这条消息");
    const response = await result.response;
    const text = response.text();
    
    console.log("---------------------------------------------------");
    console.log("3. 🎉 测试成功！AI 回复如下：");
    console.log(text);
    console.log("---------------------------------------------------");
    
  } catch (error) {
    console.error("❌ 测试失败。详细错误信息如下：");
    console.error(error);
  }
}

runTest();