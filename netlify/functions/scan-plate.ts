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
    let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_actual_gemini_api_key_here') {
      console.error("Missing Gemini API Key in Netlify environment.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on Netlify." }),
      };
    }

    // Sanitize the API Key: remove whitespace and quotes
    apiKey = apiKey.trim();
    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || 
        (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
      apiKey = apiKey.substring(1, apiKey.length - 1);
    }
    apiKey = apiKey.trim();

    // Log diagnostic info (safely masked) to Netlify console for troubleshooting
    console.log(`[Diagnostic] API Key processed: length=${apiKey.length}, startsWithAQ=${apiKey.startsWith('AQ.')}, prefixCheck=${apiKey.substring(0, 6)}...`);

    if (!imageBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No image data provided" }),
      };
    }

    // Initialize AI
    // @google/genai SDK expects an options object with apiKey
    const client = new GoogleGenAI({ apiKey });
    
    const result = await client.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: "Hãy trích xuất chính xác biển số xe từ hình ảnh này. Chỉ trả về chuỗi biển số (ví dụ: 59A-123.45). Không thêm bất kỳ ghi chú hay văn bản nào khác. Nếu không tìm thấy, trả về 'NOT_FOUND'." }
        ]
      }]
    });

    const plate = (result.text || "").trim();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate }),
    };
  } catch (error: any) {
    console.error("[Netlify Function Error]:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to scan license plate" }),
    };
  }
};
