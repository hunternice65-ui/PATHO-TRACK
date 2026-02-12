
import { GoogleGenAI, Type } from "@google/genai";
import { ScannedItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async scanItemsFromImage(base64Image: string, isBlock: boolean): Promise<ScannedItem[]> {
    const prompt = `
      Analyze this photo of medical ${isBlock ? 'blocks' : 'slides'}.
      In the photo, each ${isBlock ? 'block' : 'slide'} is a distinct rectangular object, usually with a white background or surface where text is printed/written.
      
      Extract information from EVERY visible ${isBlock ? 'block' : 'slide'}.
      For each one, find:
      1. caseId: The main identification number (e.g., S24-12345).
      2. date: Any date found on the label (YYYY-MM-DD format if possible).
      3. part: The block/slide designation (e.g., A1, B, C2).
      4. additionalInfo: Any other text like patient initials or lab notes.

      If multiple items are found, return a list.
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
      return JSON.parse(text) as ScannedItem[];
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      return [];
    }
  }
};
