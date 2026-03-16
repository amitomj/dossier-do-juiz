
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
  
  const arrayBuffer = await file.arrayBuffer();
  cachedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  cachedFile = file;
  return cachedPdf;
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

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdf = await getPdfDocument(file);
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    
    fullText += `\n--- PÁGINA ${i} ---\n${pageText}\n`;
  }

  return fullText;
};
