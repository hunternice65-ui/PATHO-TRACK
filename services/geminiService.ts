
import { GoogleGenAI, Type } from "@google/genai";
import { ScannedItem } from "../types";

export const geminiService = {
  async scanItemsFromImage(base64Image: string, isBlock: boolean): Promise<ScannedItem[]> {
    // Vercel handles process.env.API_KEY during build or at runtime if configured
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      console.error("Gemini API Key is missing. Check Vercel Environment Variables (Key: API_KEY)");
      throw new Error("API_KEY_MISSING");
    }

    try {
      // Create fresh instance
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        You are a medical pathology laboratory assistant. 
        Analyze this photo of medical ${isBlock ? 'blocks' : 'slides'}. 
        Each object has a label with text.
        
        Extract information from EVERY visible item.
        Return a JSON array where each object has:
        - caseId: The identification number (e.g., S24-12345, HN67-001)
        - date: The date on the label (YYYY-MM-DD format if possible, or as written)
        - part: The section designation (e.g., A1, B, C, 1, 2)
        - additionalInfo: Any other text like hospital name, patient initials, or special marks.

        If you can't read an item clearly, do your best or omit it. 
        Return an empty array [] if no items are found.
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

      const textOutput = response.text;
      if (!textOutput) return [];
      
      const results = JSON.parse(textOutput) as ScannedItem[];
      return results;
    } catch (error: any) {
      console.error("Gemini Scan Error Details:", error);
      if (error.message?.includes('API_KEY_INVALID')) throw new Error("API_KEY_INVALID");
      throw error;
    }
  }
};
