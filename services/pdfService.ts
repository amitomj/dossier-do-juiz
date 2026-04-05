
import * as pdfjsLib from 'pdfjs-dist';

// Configuração do worker necessária para o pdf.js via ESM
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Cache para evitar recarregar o PDF múltiplas vezes
let cachedPdf: pdfjsLib.PDFDocumentProxy | null = null;
let cachedFile: File | null = null;

export const getPdfDocument = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  if (cachedPdf && cachedFile === file) {
    return cachedPdf;
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    cachedPdf = await loadingTask.promise;
    cachedFile = file;
    return cachedPdf;
  } catch (err: any) {
    console.error("Error loading PDF:", err);
    throw new Error(`Erro ao carregar o PDF: ${err.message || 'Ficheiro inválido ou corrompido.'}`);
  }
};

export const getPageSnapshot = async (file: File, pageNumber: number): Promise<string> => {
  const pdf = await getPdfDocument(file);
  const page = await pdf.getPage(pageNumber);
  
  const viewport = page.getViewport({ scale: 1.2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not get canvas context");
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.7);
};

export const extractTextFromPdf = async (file: File): Promise<{ text: string; pages: string[]; totalPages: number }> => {
  const pdf = await getPdfDocument(file);
  const totalPages = pdf.numPages;
  const pageTexts: string[] = new Array(totalPages);
  
  // Processar em lotes para não sobrecarregar
  const batchSize = 20;
  for (let i = 1; i <= totalPages; i += batchSize) {
    const batch = [];
    for (let j = i; j < i + batchSize && j <= totalPages; j++) {
      batch.push(j);
    }
    
    await Promise.all(batch.map(async (pageNum) => {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        pageTexts[pageNum - 1] = pageText;
      } catch (e) {
        console.error(`Failed to extract text from page ${pageNum}`, e);
        pageTexts[pageNum - 1] = `[Erro na extração de texto na página ${pageNum}]`;
      }
    }));
  }

  const fullText = pageTexts.map((t, i) => `\n--- PÁGINA ${i + 1} ---\n${t}\n`).join("");
  return { text: fullText, pages: pageTexts, totalPages };
};
