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

function serializeError(err: any): string {
  if (!err) return "";
  try {
    if (err instanceof Error) {
      let str = `${err.name}: ${err.message}`;
      if (err.stack) str += `\nStack: ${err.stack}`;
      // Safely append other properties (like status, code, statusText, etc.)
      const otherProps: Record<string, any> = {};
      for (const key of Object.keys(err)) {
        otherProps[key] = (err as any)[key];
      }
      for (const key of Object.getOwnPropertyNames(err)) {
        if (key !== "stack" && key !== "message" && key !== "name") {
          otherProps[key] = (err as any)[key];
        }
      }
      if (Object.keys(otherProps).length > 0) {
        str += `\nMetadata: ${JSON.stringify(otherProps)}`;
      }
      return str;
    }
    if (typeof err === "object") {
      return JSON.stringify(err);
    }
    return String(err);
  } catch (e) {
    return String(err?.message || err?.status || err || "");
  }
}

/**
 * Executes a Gemini API generateContent call with active retry loops, exponential backoff,
 * and high-availability model fallback to handle 503 (spikes in demand / temporary unavailability)
 * and 429 (Resource Exhausted) errors gracefully.
 */
async function reliableGenerateContent(params: {
  model: string;
  contents: any;
  config?: any;
}): Promise<any> {
  // A sequential, safe model fallback list.
  // If the primary model fails after multiple retries, we fallback to other highly available engines.
  const modelsToTry = [
    params.model,
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    if (!currentModel) continue;

    const maxRetries = 2; // Real-time 3 attempts per model
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini HA Router] Calling model ${currentModel} (Attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const response = await getAi().models.generateContent({
          ...params,
          model: currentModel,
        });

        // If call succeeded, return the response immediately
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = serializeError(err).toLowerCase();
        
        // Identify transient / retryable errors (503, 429, server overload, html errors, etc.)
        const isTransient = 
          errStr.includes("503") || 
          errStr.includes("unavailable") || 
          errStr.includes("demand") || 
          errStr.includes("temporary") ||
          errStr.includes("429") ||
          errStr.includes("exhausted") ||
          errStr.includes("rate limit") ||
          errStr.includes("overloaded") ||
          errStr.includes("quota") ||
          errStr.includes("unexpected token") ||
          errStr.includes("doctype") ||
          errStr.includes("html") ||
          errStr.includes("json");

        if (isTransient && attempt < maxRetries) {
          // Calculate exponential backoff delay (e.g., attempt 0: 1000ms, attempt 1: 2000ms) with a randomized jitter
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 400;
          console.warn(`[Gemini HA Router] Retrying due to transient error on ${currentModel} in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          // If the error is not transient or we exhausted all retries for this model,
          // log and break to next model in the high availability list
          console.error(`[Gemini HA Router] Model ${currentModel} failed permanently or exhausted all retries. Error:`, errStr);
          break;
        }
      }
    }
  }

  // If all models and their retries failed, propagate the last error back to the client
  throw lastError;
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

    const response = await reliableGenerateContent({
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
    const errorDetail = serializeError(error);
    
    let userFriendlyError = error?.message || error?.toString() || "Erreur de transcription de document";
    const fullErrStr = (errorDetail + " " + userFriendlyError).toLowerCase();

    if (
      fullErrStr.includes("503") || 
      fullErrStr.includes("unavailable") || 
      fullErrStr.includes("demand") ||
      fullErrStr.includes("temporary") ||
      fullErrStr.includes("overloaded") ||
      fullErrStr.includes("unexpected token") ||
      fullErrStr.includes("doctype") ||
      fullErrStr.includes("html")
    ) {
      userFriendlyError = "Les serveurs de transcription Gemini de Google subissent actuellement une surcharge temporaire suite à une très forte demande mondiale (Erreur 503). Vos images ont été correctement optimisées pour le réseau. Veuillez patienter 5 à 10 secondes puis cliquer à nouveau pour retenter d'envoyer votre scan.";
    } else if (
      fullErrStr.includes("429") || 
      fullErrStr.includes("exhausted") || 
      fullErrStr.includes("rate limit") ||
      fullErrStr.includes("quota")
    ) {
      userFriendlyError = "La limite de requêtes par minute de l'API de démonstration a été temporairement atteinte (Erreur 429). Pour assurer une fluidité durable, merci de patienter environ 20-30 secondes avant de cliquer à nouveau sur le bouton de scan.";
    }
    throw new Error(`Erreur d'analyse IA : ${userFriendlyError}`);
  }
}

export async function formatTranscriptionText(text: string, style: string, language: string = "French"): Promise<string> {
  try {
    let instruction = "";
    if (style === "bullets") {
      instruction = "Convertis ce texte brut issu d'écriture manuscrite en une liste à puces structurée, claire et aérée. Synthétise les informations importantes de manière logique sous forme de puces. Nettoie les hésitations de langage tout en corrigeant rigoureusement toutes les fautes d'orthographe, de grammaire ou de frappe.";
    } else if (style === "formal") {
      instruction = "Réécris ce texte brut issu d'écriture manuscrite pour en faire un courrier ou e-mail professionnel et formel extrêmement poli et bien tourné. Choisis un ton administratif approprié si nécessaire, structure-le proprement (salutations, corps, formule de politesse). Corrige impeccablement l'orthographe et la grammaire française.";
    } else if (style === "resume") {
      instruction = "Mets en forme ce texte sous la forme d'un rapport professionnel structuré ou compte-rendu clair. Ajoute des en-têtes et des divisions de sections si nécessaire. Rends sa lecture fluide, agréable et professionnelle. Corrige toutes les fautes d'orthographe, de grammaire, de conjugaison et de ponctuation.";
    } else {
      // standard
      instruction = "Mets en forme ce texte brut issu d'écriture manuscrite de manière propre et aérée avec des paragraphes fluides et bien structurés. Corrige rigoureusement les fautes d'orthographe, de grammaire, d'accents, de ponctuation ou de frappe introduites par le scan ou une écriture manuscrite imparfaite. Conserve fidèlement l'intégralité du sens d'origine.";
    }

    const response = await reliableGenerateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: `${instruction}
          
Texte d'origine à mettre en forme :
"""
${text}
"""`,
        }
      ]
    });

    return response.text || text;
  } catch (error: any) {
    console.error("Formatting error:", error);
    const errorDetail = serializeError(error);
    
    let userFriendlyError = error?.message || error?.toString() || "Erreur de mise en forme par l'IA";
    const fullErrStr = (errorDetail + " " + userFriendlyError).toLowerCase();

    if (
      fullErrStr.includes("503") || 
      fullErrStr.includes("unavailable") || 
      fullErrStr.includes("demand") ||
      fullErrStr.includes("temporary") ||
      fullErrStr.includes("overloaded") ||
      fullErrStr.includes("unexpected token") ||
      fullErrStr.includes("doctype") ||
      fullErrStr.includes("html")
    ) {
      userFriendlyError = "Le module de mise en forme automatique de Gemini est temporairement saturé en raison d'une forte demande. Veuillez patienter quelques secondes puis retenter la mise en forme.";
    } else if (
      fullErrStr.includes("429") || 
      fullErrStr.includes("exhausted") || 
      fullErrStr.includes("rate limit") ||
      fullErrStr.includes("quota")
    ) {
      userFriendlyError = "La cadence de requête autorisée pour la mise en forme de texte par l'IA a été dépassée (Erreur 429). Merci de patienter une trentaine de secondes avant d'appliquer un nouveau style.";
    }
    throw new Error(`Erreur de formatage par l'IA : ${userFriendlyError}`);
  }
}
