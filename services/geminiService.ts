
import { GoogleGenAI, Type } from "@google/genai";
import { ScannedItem } from "../types";

export const geminiService = {
  async scanItemsFromImage(base64Image: string, isBlock: boolean): Promise<ScannedItem[]> {
    // Safely attempt to get the API Key
    let apiKey = '';
    try {
      apiKey = (process.env && process.env.API_KEY) ? process.env.API_KEY : '';
    } catch (e) {
      apiKey = '';
    }
    
    if (!apiKey || apiKey === 'undefined') {
      console.error("Gemini API Key is missing.");
      throw new Error("API_KEY_MISSING");
    }

    try {
      // Create a new instance right before use to ensure it captures the latest selected key
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        Analyze this photo of medical ${isBlock ? 'blocks' : 'slides'}.
        Extract information from EVERY visible item.
        Return a JSON array with:
        - caseId: Identification number (e.g., S24-12345)
        - date: Date on the label (YYYY-MM-DD)
        - part: Section designation (e.g., A1, B, C)
        - additionalInfo: Any other text found.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                caseId: { type: Type.STRING },
                date: { type: Type.STRING },
                part: { type: Type.STRING },
                additionalInfo: { type: Type.STRING },
              },
              required: ["caseId", "part"]
            }
          }
        }
      });

      const text = response.text;
      return text ? JSON.parse(text) : [];
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error.message?.includes('not found')) throw new Error("API_KEY_NOT_FOUND");
      throw error;
    }
  }
};
