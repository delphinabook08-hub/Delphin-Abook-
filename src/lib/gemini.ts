import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("La clé d'API GEMINI_API_KEY n'est pas configurée dans les paramètres. Veuillez l'ajouter pour utiliser l'OCR.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

export interface TranscriptionResult {
  text: string;
  tableData?: string[][]; // Array of rows, each row is an array of cells
}

export async function transcribeHandwriting(base64Images: string | string[], mimeType: string, language: string = "English"): Promise<TranscriptionResult> {
  try {
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    const imageParts = images.map(img => ({
      inlineData: {
        mimeType,
        data: img.split(",")[1] || img,
      },
    }));

    const response = await getAi().models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            text: `Transcribe the handwriting in these images in ${language}. 
            Analyze the document carefully:
            1. Provide the full transcription of ALL pages as plain text in the 'text' field.
            2. IMPORTANT: Begin the transcription of each individual image/page with a clear marker like "[--- Page X ---]" where X is the page number.
            3. APPLY AUTO-CORRECTION: Fix common typos, spelling mistakes, and obvious grammatical errors while preserving the original meaning and intent.
            4. EXCEL EXTRACTION (tableData): Focus on detecting structured tables defined by large black lines (grandes lignes noires). 
            5. EXCLUSIVE MANUSCRIPT EXTRACTION: For the 'tableData' (Excel) specifically, extract ONLY handwritten information (manuscripts).
            6. IGNORE TYPED/PRE-FILLED TEXT: Strictly ignore all pre-printed, typed, or already entered characters in the table. Focus on capturing only the additions written in BLUE and RED ink.
            7. If no table is found or if no blue/red handwriting is present in a table context, 'tableData' should be empty or omitted.
            8. Preserve the natural reading order across all pages.`,
          },
          ...imageParts,
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "The full transcribed text.",
            },
            tableData: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              description: "2D array representing table rows and cells.",
            },
          },
          required: ["text"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      text: result.text || "No text detected.",
      tableData: result.tableData && result.tableData.length > 0 ? result.tableData : undefined
    };
  } catch (error: any) {
    console.error("Transcription error:", error);
    const parsedError = error?.message || error?.status || error?.toString() || "Transcription error";
    throw new Error(`Erreur d'analyse IA : ${parsedError}`);
  }
}
