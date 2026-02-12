
import { GoogleGenAI, Type } from "@google/genai";
import { ScannedItem } from "../types";

export const geminiService = {
  async scanItemsFromImage(base64Image: string, isBlock: boolean): Promise<ScannedItem[]> {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("Gemini API Key is missing. Ensure API_KEY is set in Vercel environment variables.");
      throw new Error("API_KEY_MISSING");
    }

    // Create a new instance right before use to ensure the latest key is used
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Analyze this photo of medical ${isBlock ? 'blocks' : 'slides'}.
      In the photo, each ${isBlock ? 'block' : 'slide'} is a distinct rectangular object with text labels.
      
      Extract information from EVERY visible ${isBlock ? 'block' : 'slide'}.
      Return the data in a JSON array with these fields:
      1. caseId: The identification number (e.g., S24-12345).
      2. date: The date on the label (YYYY-MM-DD).
      3. part: The designation (e.g., A1, B, C).
      4. additionalInfo: Any extra text found.

      If no items are found, return an empty array [].
    `;

    try {
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
      if (!text) return [];
      
      const results = JSON.parse(text) as ScannedItem[];
      
      // Filter unique items locally as a safety measure
      return results.filter((item, index, self) =>
        index === self.findIndex((t) => (
          (t.caseId || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === (item.caseId || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase() &&
          (t.part || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === (item.part || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        ))
      );
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      throw error;
    }
  }
};
