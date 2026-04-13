
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { TokenMetrics, Citation } from "../types";

const getAIClient = () => {
  // 1. Check if we are in AI Studio environment
  // @ts-ignore
  if (typeof window !== 'undefined' && window.aistudio) {
    // In AI Studio preview, the platform handles the key automatically
    // We can use a placeholder or the environment variable if available
    const platformKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AI_STUDIO_MANAGED';
    return new GoogleGenAI({ apiKey: platformKey });
  }

  // 2. For external deployments, use the manual key from localStorage
  const manualKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
  
  const isValid = (k: string | null | undefined) => 
    !!k && k.trim().length > 10 && k.startsWith('AIza');

  if (!isValid(manualKey)) {
    throw new Error('Chave API não encontrada. Por favor, configure a sua chave no ecrã inicial.');
  }
  
  return new GoogleGenAI({ apiKey: manualKey! });
};

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
    const isQuotaError = errorMsg.includes('429') || error?.status === 429 || error?.code === 429 || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isUnavailableError = errorMsg.includes('503') || error?.status === 503 || error?.code === 503 || errorMsg.includes('UNAVAILABLE');
    const isSpendingCap = errorMsg.toLowerCase().includes('spending cap') || errorMsg.toLowerCase().includes('billing');
    
    if ((isQuotaError || isUnavailableError) && !isSpendingCap && retries > 0) {
      const errorType = isQuotaError ? 'Quota exceeded (429)' : 'Service Unavailable (503)';
      console.warn(`${errorType}. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function attemptJsonRepair(jsonStr: string): any {
  let repaired = jsonStr.trim();
  
  // 1. Limpeza básica de markdown
  repaired = repaired.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  
  // 2. Tentar parse direto primeiro
  try {
    return JSON.parse(repaired);
  } catch (e) {
    // Se falhar, continuamos para as tentativas de reparação
  }

  // 3. Lidar com caracteres de escape truncados no final
  if (repaired.endsWith('\\')) repaired = repaired.slice(0, -1);
  
  // 4. Lidar com aspas abertas
  let openQuote = false;
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '"' && (i === 0 || repaired[i-1] !== '\\')) {
      openQuote = !openQuote;
    }
  }
  if (openQuote) repaired += '"';

  // 5. Lidar com vírgulas pendentes
  repaired = repaired.trim().replace(/,$/, "");

  // 6. Lidar com pares chave-valor truncados (ex: "key": ou "key")
  if (repaired.trim().endsWith(':')) {
    repaired += 'null';
  }

  // 7. Balancear chavetas e parênteses retos (ignorando conteúdo dentro de strings)
  const stack: string[] = [];
  const map: Record<string, string> = { '{': '}', '[': ']' };
  let inString = false;
  
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && (i === 0 || repaired[i-1] !== '\\')) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(map[char]);
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }
  
  // Fechar a stack
  let finalRepaired = repaired;
  while (stack.length > 0) {
    const closer = stack.pop()!;
    finalRepaired = finalRepaired.trim().replace(/,$/, "");
    finalRepaired += closer;
  }

  try {
    return JSON.parse(finalRepaired);
  } catch (e) {
    // 8. TENTATIVA FINAL: Se ainda falhar, procurar o último objeto completo no array "documentos"
    // Isso é útil se a truncagem aconteceu no meio de um objeto
    const lastCompleteObject = repaired.lastIndexOf('}');
    if (lastCompleteObject !== -1) {
      let truncated = repaired.substring(0, lastCompleteObject + 1);
      // Tentar fechar o array e o objeto raiz
      if (truncated.includes('"documentos"')) {
        // Se não terminar com ], assumimos que o array documentos ainda está aberto
        if (!truncated.includes(']')) truncated += ']';
        // Se não terminar com }, assumimos que o objeto raiz ainda está aberto
        if (!truncated.endsWith('}')) truncated += '}';
        
        try {
          return JSON.parse(truncated);
        } catch (e2) {
          // Tentar uma abordagem mais cega de fechar tudo
          let blindRepair = truncated;
          const blindStack: string[] = [];
          let blindInString = false;
          for (let i = 0; i < blindRepair.length; i++) {
            if (blindRepair[i] === '"' && (i === 0 || blindRepair[i-1] !== '\\')) { blindInString = !blindInString; continue; }
            if (!blindInString) {
              if (blindRepair[i] === '{' || blindRepair[i] === '[') blindStack.push(map[blindRepair[i]]);
              else if (blindRepair[i] === '}' || blindRepair[i] === ']') { if (blindStack.length > 0 && blindStack[blindStack.length - 1] === blindRepair[i]) blindStack.pop(); }
            }
          }
          while (blindStack.length > 0) blindRepair += blindStack.pop();
          try { return JSON.parse(blindRepair); } catch (e3) { return null; }
        }
      }
    }
    return null;
  }
}

async function extractMasterIndex(pages: string[], ai: any) {
  // Usually the index is in the first 10 pages
  const indexPages = pages.slice(0, 10).join('\n\n');
  
  console.log("Phase 1: Extracting Master Index...");
  
  const response = await withRetry(async () => {
    return await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise as páginas iniciais deste processo judicial e extraia o ÍNDICE COMPLETO.
      
      ESTRUTURA DO ÍNDICE:
      [Refª do Ato] | [Nome do Ato] > [Refª do Documento] [Nome do Documento] ... [Página]
      
      REGRAS:
      1. Extraia CADA LINHA do índice.
      2. Ignore o conteúdo das páginas, foque APENAS na tabela/lista de índice.
      3. Se o índice continuar em várias páginas, extraia tudo.
      4. Gere um 'id_documento' ÚNICO para cada linha (ex: "doc_1", "doc_2", etc).
      
      TEXTO:\n\n${indexPages}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0,
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
                  ref_ato: { type: Type.STRING },
                  ref_documento: { type: Type.STRING },
                  tipo_documento_indice: { type: Type.STRING },
                  pagina_inicial: { type: Type.NUMBER },
                  titulo_resumido: { type: Type.STRING }
                },
                required: ["id_documento", "ref_ato", "ref_documento", "pagina_inicial", "titulo_resumido"]
              }
            }
          },
          required: ["documentos"]
        }
      }
    });
  });

  let jsonText = response.text.trim();
  let result = attemptJsonRepair(jsonText);
  return result || { documentos: [] };
}

export const analyzeProcessText = async (pages: string[], totalPages: number) => {
  const CHUNK_SIZE = 40; 
  const OVERLAP = 5;    
  
  const ai = getAIClient();
  
  // Phase 1: Get the Index
  const masterIndexResult = await extractMasterIndex(pages, ai);
  let allDocumentos = masterIndexResult.documentos.map((doc: any, idx: number) => ({
    ...doc,
    indexOrder: idx,
    sumario: '',
    sub_documentos: [],
    pagina_final: 0 // Will be calculated
  }));

  // Calculate pagina_final based on next document's pagina_inicial
  for (let i = 0; i < allDocumentos.length; i++) {
    if (i < allDocumentos.length - 1) {
      allDocumentos[i].pagina_final = allDocumentos[i+1].pagina_inicial - 1;
    } else {
      allDocumentos[i].pagina_final = totalPages;
    }
  }

  let globalMetadata: any = {
    numero_processo: masterIndexResult.numero_processo || '',
    tribunal: masterIndexResult.tribunal || '',
    juizo: masterIndexResult.juizo || ''
  };

  let totalMetrics: TokenMetrics = {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0
  };

  // Phase 2: Enrich Content in chunks
  for (let i = 0; i < totalPages; i += (CHUNK_SIZE - OVERLAP)) {
    const startPage = i + 1;
    const endPage = Math.min(i + CHUNK_SIZE, totalPages);
    const chunkText = pages.slice(i, endPage).join('\n\n');
    
    // Find which documents from master index are in this chunk
    const docsInChunk = allDocumentos.filter(doc => 
      (doc.pagina_inicial >= startPage && doc.pagina_inicial <= endPage) ||
      (doc.pagina_final >= startPage && doc.pagina_final <= endPage) ||
      (doc.pagina_inicial <= startPage && doc.pagina_final >= endPage)
    );

    if (docsInChunk.length === 0) continue;

    console.log(`Processing enrichment chunk: pages ${startPage} to ${endPage}...`);

    const result = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `ENRIQUECIMENTO DE CONTEÚDO (Páginas ${startPage} a ${endPage}).
        
        VOCÊ JÁ TEM O ÍNDICE. NÃO CRIE NOVOS DOCUMENTOS DE TOPO.
        
        LISTA DE DOCUMENTOS NESTAS PÁGINAS (DO ÍNDICE):
        ${JSON.stringify(docsInChunk.map(d => ({ id: d.id_documento, titulo: d.titulo_resumido, paginas: `${d.pagina_inicial}-${d.pagina_final}` })))}

        TAREFA:
        1. Para cada documento acima, crie um 'sumario' conciso (máx 3 frases) baseado no conteúdo real.
        2. Extraia a 'parte_apresentante' (quem apresentou a peça) e 'mandatario' (advogado), se visíveis.
        3. Identifique 'sub_documentos' (anexos, certidões, e-mails internos) que aparecem nestas páginas mas NÃO estão no índice como itens de topo.
        4. Se encontrar metadados globais (processo, tribunal) que ainda faltam, extraia-os.
        
        TEXTO:\n\n${chunkText}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              numero_processo: { type: Type.STRING },
              tribunal: { type: Type.STRING },
              juizo: { type: Type.STRING },
              enriquecimento: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id_documento: { type: Type.STRING },
                    sumario: { type: Type.STRING },
                    parte_apresentante: { type: Type.STRING },
                    mandatario: { type: Type.STRING },
                    sub_documentos: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          titulo: { type: Type.STRING },
                          descricao: { type: Type.STRING },
                          pagina_pdf: { type: Type.NUMBER }
                        },
                        required: ["id", "titulo", "pagina_pdf"]
                      }
                    }
                  },
                  required: ["id_documento"]
                }
              }
            }
          }
        }
      });

      totalMetrics.promptTokens += response.usageMetadata?.promptTokenCount || 0;
      totalMetrics.candidatesTokens += response.usageMetadata?.candidatesTokenCount || 0;
      totalMetrics.totalTokens += response.usageMetadata?.totalTokenCount || 0;

      return attemptJsonRepair(response.text) || { enriquecimento: [] };
    });

    // Merge enrichment back to allDocumentos
    if (result.enriquecimento) {
      result.enriquecimento.forEach((enr: any) => {
        const doc = allDocumentos.find(d => d.id_documento === enr.id_documento);
        if (doc) {
          if (enr.sumario) doc.sumario = enr.sumario;
          if (enr.parte_apresentante) doc.parte_apresentante = enr.parte_apresentante;
          if (enr.mandatario) doc.mandatario = enr.mandatario;
          if (enr.sub_documentos) {
            // Avoid duplicate sub-docs
            enr.sub_documentos.forEach((sub: any) => {
              if (!doc.sub_documentos.some((s: any) => s.titulo === sub.titulo && s.pagina_pdf === sub.pagina_pdf)) {
                doc.sub_documentos.push(sub);
              }
            });
          }
        }
      });
    }

    if (result.numero_processo && !globalMetadata.numero_processo) globalMetadata.numero_processo = result.numero_processo;
    if (result.tribunal && !globalMetadata.tribunal) globalMetadata.tribunal = result.tribunal;
    if (result.juizo && !globalMetadata.juizo) globalMetadata.juizo = result.juizo;
  }

  return {
    ...globalMetadata,
    documentos: allDocumentos,
    metrics: totalMetrics,
    isTruncated: false
  };
};

export const askAssistant = async (query: string, fullText: string, contextDocs: string) => {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
