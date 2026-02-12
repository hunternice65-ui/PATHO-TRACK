
import { GoogleGenAI, Type } from "@google/genai";
import { ScannedItem } from "../types";

// Safety check for Vercel Environment Variables
const API_KEY = process.env.API_KEY || '';
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const geminiService = {
  async scanItemsFromImage(base64Image: string, isBlock: boolean): Promise<ScannedItem[]> {
    if (!ai) {
      console.error("Gemini API Key is missing. Check Vercel Project Settings.");
      return [];
    }

    const prompt = `
      Analyze this photo of medical ${isBlock ? 'blocks' : 'slides'}.
      In the photo, each ${isBlock ? 'block' : 'slide'} is a distinct rectangular object, usually with a white background or surface where text is printed/written.
      
      Extract information from EVERY visible ${isBlock ? 'block' : 'slide'}.
      For each one, find:
      1. caseId: The main identification number (e.g., S24-12345).
      2. date: Any date found on the label (YYYY-MM-DD format if possible).
      3. part: The block/slide designation (e.g., A1, B, C2).
      4. additionalInfo: Any other text like patient initials or lab notes.

      If multiple items are found, return a list. Ensure no duplicate entries are in the returned JSON array.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
            { text: prompt }
          ]
        },
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
      if (!text) return [];
      
      const results = JSON.parse(text) as ScannedItem[];
      
      // Secondary filter to ensure unique items in one scan
      return results.filter((item, index, self) =>
        index === self.findIndex((t) => (
          t.caseId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === item.caseId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() &&
          t.part.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === item.part.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        ))
      );
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      return [];
    }
  }
};
