import { Handler } from "@netlify/functions";
import * as genai from "@google/genai";

// Defensively handle different import styles
const GoogleGenAI = genai.GoogleGenAI || (genai as any).default?.GoogleGenAI;

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { imageBase64 } = JSON.parse(event.body || "{}");
    const rawKeys: string[] = [];
    if (process.env.GEMINI_API_KEY) rawKeys.push(...process.env.GEMINI_API_KEY.split(','));
    if (process.env.GEMINI_API_KEYS) rawKeys.push(...process.env.GEMINI_API_KEYS.split(/[\r\n,]+/));
    Object.keys(process.env).forEach(k => {
      if (/^GEMINI_API_KEY_\d+$/i.test(k) && process.env[k]) {
        rawKeys.push(process.env[k] as string);
      }
    });
    if (process.env.VITE_GEMINI_API_KEY) rawKeys.push(...process.env.VITE_GEMINI_API_KEY.split(','));
    const apiKeys = Array.from(new Set(
      rawKeys
        .map(k => (k || '').trim().replace(/^["']|["']$/g, ''))
        .filter(k => k && k !== 'your_actual_gemini_api_key_here' && k.length > 10)
    ));

    if (apiKeys.length === 0) {
      console.error("Missing Gemini API Key in Netlify environment.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on Netlify." }),
      };
    }

    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No image data provided" }),
      };
    }

    const MODEL_NAME = 'gemini-3.1-flash-lite';
    let lastError: any = null;
    let plateResult: string | null = null;

    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];
      const client = new GoogleGenAI({ apiKey });

      try {
        const result = await client.models.generateContent({
          model: MODEL_NAME,
          contents: [{
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: "Hãy trích xuất chính xác biển số xe từ hình ảnh này. Chỉ trả về chuỗi biển số (ví dụ: 59A-123.45). Không thêm bất kỳ ghi chú hay văn bản nào khác. Nếu không tìm thấy, trả về 'NOT_FOUND'." }
            ]
          }]
        });

        let text = (result.text || "").trim();
        text = text.replace(/```[a-zA-Z]*\n?|\n?```/g, '').trim();
        plateResult = text;
        break;
      } catch (modelErr: any) {
        lastError = modelErr;
        continue;
      }
    }

    if (plateResult !== null) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: plateResult }),
      };
    }

    throw lastError || new Error("Failed to scan license plate");
  } catch (error: any) {
    console.error("[Netlify Function Error]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
