// lib/gemini.js
// 2025-11-30 Fix: Using a model CONFIRMED to be in your access list
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let model;

try {
  if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // CRITICAL FIX: Using 'gemini-2.0-flash' which is explicitly in your available list
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }
} catch (e) {
  console.error("Gemini Initialization Failed:", e);
}

export async function geminiChat(historyMessages, userMessage) {
  if (!model) {
    return "System Error: Google API Key not configured.";
  }

  try {
    // 1. Simple format conversion
    let validHistory = historyMessages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 2. Remove first message if it's from AI (API requirement)
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
      validHistory.shift(); 
    }

    const chat = model.startChat({
      history: validHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Gemini Error:", error.toString());
    return "AI connection failed. Please check Vercel logs.";
  }
}