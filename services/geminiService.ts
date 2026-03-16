
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { TokenMetrics, Citation } from "../types";

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
    if (isQuotaError && retries > 0) {
      console.warn(`Quota exceeded (429). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function attemptJsonRepair(jsonStr: string): any {
  let repaired = jsonStr.trim();
  repaired = repaired.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  if (repaired.endsWith('\\')) repaired = repaired.slice(0, -1);
  const unescapedQuotes = repaired.replace(/\\"/g, '').match(/"/g) || [];
  if (unescapedQuotes.length % 2 !== 0) {
    repaired += '"';
  }
  const stack: string[] = [];
  const openChars = ['{', '['];
  const closeChars = ['}', ']'];
  const map: Record<string, string> = { '{': '}', '[': ']' };
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (openChars.includes(char)) {
      stack.push(map[char]);
    } else if (closeChars.includes(char)) {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop();
      }
    }
  }
  while (stack.length > 0) {
    const closer = stack.pop()!;
    repaired = repaired.trim().replace(/,$/, "");
    repaired += closer;
  }
  try {
    return JSON.parse(repaired);
  } catch (e) {
    return null;
  }
}

export const analyzeProcessText = async (fullText: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise este processo judicial português. 
      IDENTIFIQUE O NÚMERO DO PROCESSO NA PRIMEIRA PÁGINA (CAPA) E MAPEIE TODO O ÍNDICE.
      Atribua corretamente os papéis (Juiz para Tribunal, Procurador para Ministério Público).
      Propague o numero_processo para cada documento.
      
      TEXTO INTEGRAL:\n\n${fullText}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0,
        thinkingConfig: { thinkingBudget: 4000 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            numero_processo: { type: Type.STRING },
            tribunal: { type: Type.STRING },
            juizo: { type: Type.STRING },
            documentos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id_documento: { type: Type.STRING },
                  numero_processo: { type: Type.STRING },
                  ref_ato: { type: Type.STRING },
                  ref_documento: { type: Type.STRING },
                  tipo_documento_principal: { type: Type.STRING },
                  tipo_documento_indice: { type: Type.STRING },
                  parte_apresentante: { type: Type.STRING },
                  mandatario: { type: Type.STRING },
                  pagina_inicial: { type: Type.NUMBER },
                  pagina_final: { type: Type.NUMBER },
                  titulo_resumido: { type: Type.STRING },
                  sumario: { type: Type.STRING },
                  data_documento: { type: Type.STRING }
                },
                required: ["id_documento", "ref_ato", "ref_documento", "pagina_inicial", "parte_apresentante"]
              }
            }
          },
          required: ["numero_processo", "documentos"]
        }
      }
    });

    const metrics: TokenMetrics = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0
    };

    let jsonText = response.text.trim();
    const result = attemptJsonRepair(jsonText) || { documentos: [] };
    return { ...result, metrics };
  });
};

export const askAssistant = async (query: string, fullText: string, contextDocs: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Você é um Assistente Jurídico de elite. Use o texto integral do processo fornecido para responder à pergunta do utilizador com EXTREMA PRECISÃO e DETALHE.
      
      CONTEÚDO INTEGRAL DO PROCESSO:
      ${fullText}

      METADADOS DAS PEÇAS:
      ${contextDocs}

      PERGUNTA:
      ${query}`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ref_documento: { type: Type.STRING },
                  pagina: { type: Type.NUMBER },
                  titulo: { type: Type.STRING }
                },
                required: ["ref_documento", "pagina", "titulo"]
              }
            }
          },
          required: ["answer", "citations"]
        }
      }
    });

    const metrics: TokenMetrics = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0
    };

    const result = attemptJsonRepair(response.text) || { answer: "Lamento, não consegui processar a resposta.", citations: [] };
    return { ...result, metrics };
  });
};
