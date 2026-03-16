
import React, { useEffect, useRef, useState } from 'react';
import { getPdfDocument } from '../services/pdfService';

interface PdfPagePreviewProps {
  file: File | null;
  pageNumber: number;
  snapshot?: string; // Imagem já pronta em Base64
  className?: string;
  autoHeight?: boolean;
}

export const PdfPagePreview: React.FC<PdfPagePreviewProps> = ({ file, pageNumber, snapshot, className, autoHeight = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Se temos o snapshot, usamos a imagem diretamente (instantâneo)
    if (snapshot) {
      setLoading(false);
      return;
    }

    // Caso contrário, renderizamos via pdf.js (fallback)
    let isMounted = true;
    if (!file) return;

    const renderPage = async () => {
      try {
        setLoading(true);
        const pdf = await getPdfDocument(file);
        const page = await pdf.getPage(pageNumber);
        
        if (!isMounted || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
        }
        setLoading(false);
      } catch (err) {
        console.error("Error rendering PDF preview:", err);
        setLoading(false);
      }
    };

    renderPage();
    return () => { isMounted = false; };
  }, [file, pageNumber, snapshot]);

  return (
    <div className={`relative overflow-y-auto bg-slate-100 rounded-xl border border-slate-200 shadow-inner ${className}`} style={{ height: autoHeight ? 'auto' : '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pág. {pageNumber}</span>
          </div>
        </div>
      )}
      
      {snapshot ? (
        <img src={snapshot} className="mx-auto shadow-2xl my-4 bg-white" style={{ maxWidth: '95%' }} alt={`Página ${pageNumber}`} />
      ) : (
        <canvas ref={canvasRef} className="mx-auto shadow-2xl my-4 bg-white" style={{ maxWidth: '95%' }} />
      )}
    </div>
  );
};
