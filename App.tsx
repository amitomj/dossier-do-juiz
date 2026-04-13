
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocumentMetadata, ProcessAnalysis, SortOrder, TokenMetrics, ChatMessage } from './types';
import { analyzeProcessText } from './services/geminiService';
import { extractTextFromPdf, getPageSnapshot, getPdfDocument } from './services/pdfService';
import { DocumentGroup } from './components/DocumentGroup';
import { DocumentDetail } from './components/DocumentDetail';
import { AssistantView } from './components/AssistantView';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { 
  Search, 
  Upload, 
  Gavel, 
  FileText, 
  FileUp,
  Clock,
  SortAsc,
  ListFilter,
  Download,
  FolderOpen,
  LayoutGrid,
  Bot,
  Key,
  AlertTriangle,
  ExternalLink,
  Cpu,
  Loader2,
  Paperclip,
  Archive
} from 'lucide-react';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>(''); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'extracting' | 'analyzing' | 'snapshots' | null>(null);
  const [snapshotProgress, setSnapshotProgress] = useState({ current: 0, total: 0 });
  const [analysis, setAnalysis] = useState<ProcessAnalysis | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [selectedSubDocPage, setSelectedSubDocPage] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('index');
  const [error, setError] = useState<{ message: string; isQuota?: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'assistant'>('timeline');
  const [isExporting, setIsExporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const relinkPdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      if (window.aistudio) {
        try {
          // @ts-ignore
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } catch (err) {
          console.error("Error checking API key:", err);
          setHasApiKey(false);
        }
      } else {
        // For external deployments (Vercel, etc.)
        const manualKey = localStorage.getItem('GEMINI_API_KEY');
        
        // Robust check: must be a string and look like a Gemini key (starts with AIza)
        const isValid = (k: string | null | undefined) => 
          !!k && k.trim().length > 10 && k.startsWith('AIza');

        // We only skip the setup screen if the user has a valid key in localStorage
        const isKeyPresent = isValid(manualKey);
        setHasApiKey(isKeyPresent);
      }
    };
    checkApiKey();
  }, []);

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = manualApiKey.trim();
    if (key.startsWith('AIza') && key.length > 10) {
      localStorage.setItem('GEMINI_API_KEY', key);
      setHasApiKey(true);
      setError(null);
    } else {
      setError(new Error('A chave deve começar por "AIza" e ser válida.'));
    }
  };

  const handleOpenKeySelection = async () => {
    // @ts-ignore
    if (window.aistudio) {
      try {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true); // Assume success to proceed
        setError(null);
      } catch (err) {
        console.error("Failed to open key selection", err);
      }
    } else {
      // If not in AI Studio, we can't open the selection dialog
      setError({ message: 'Para utilizar esta aplicação, por favor introduza a sua chave da API no campo acima.' });
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError({ message: 'Por favor, selecione apenas ficheiros PDF para análise.' });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      setProcessingStep('extracting');
      const { text: extractedText, pages, totalPages } = await extractTextFromPdf(file);
      
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error("Não foi possível extrair texto do PDF. O ficheiro pode estar protegido, corrompido ou ser composto apenas por imagens sem OCR.");
      }

      setRawText(extractedText);
      
      setProcessingStep('analyzing');
      console.log(`Analyzing ${totalPages} pages of text in chunks...`);
      const result = await analyzeProcessText(pages, totalPages);
      
      if (!result || !result.documentos || result.documentos.length === 0) {
        throw new Error("A IA não conseguiu identificar documentos no índice. Por favor, verifique se o PDF contém um índice legível nas primeiras páginas.");
      }

      // ORDENAÇÃO E PÓS-PROCESSAMENTO PARA GARANTIR PÁGINAS FINAIS
      const sortedDocs = [...result.documentos].sort((a, b) => a.pagina_inicial - b.pagina_inicial);
      
      for (let i = 0; i < sortedDocs.length; i++) {
        const doc = sortedDocs[i];
        
        // Garante o número do processo em cada doc
        doc.numero_processo = result.numero_processo || doc.numero_processo;

        // Calcula página final baseando-se no próximo documento se não vier da IA
        if (!doc.pagina_final || doc.pagina_final <= doc.pagina_inicial) {
          if (i < sortedDocs.length - 1) {
            doc.pagina_final = sortedDocs[i + 1].pagina_inicial - 1;
          } else {
            doc.pagina_final = totalPages;
          }
        }

        // Reconstruct texto_integral from pages array (saves AI output tokens)
        const startPage = Math.max(1, doc.pagina_inicial);
        const endPage = Math.min(totalPages, doc.pagina_final || totalPages);
        doc.texto_integral = pages.slice(startPage - 1, endPage).join('\n\n');
      }

      setAnalysis({ ...result, documentos: sortedDocs });
      setChatHistory([]);
      setIsProcessing(false);
      setProcessingStep(null);

      // GERAÇÃO DE SNAPSHOTS EM BACKGROUND (PARALELIZADA EM LOTES)
      setSnapshotProgress({ current: 0, total: sortedDocs.length });
      
      const batchSize = 3;
      for (let i = 0; i < sortedDocs.length; i += batchSize) {
        const batch = sortedDocs.slice(i, i + batchSize);
        await Promise.all(batch.map(async (doc, idx) => {
          try {
            const snapshot = await getPageSnapshot(file, doc.pagina_inicial);
            setAnalysis(prev => {
              if (!prev) return prev;
              const newDocs = [...prev.documentos];
              const docIdx = newDocs.findIndex(d => d.id_documento === doc.id_documento);
              if (docIdx !== -1) {
                newDocs[docIdx] = { ...newDocs[docIdx], snapshot };
              }
              return { ...prev, documentos: newDocs };
            });
          } catch (e) {
            console.warn(`Snapshot failed for doc ${doc.id_documento}`);
          }
          setSnapshotProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, sortedDocs.length) }));
        }));
      }
    } catch (err: any) {
      console.error("Processing error:", err);
      const errorMsg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      const isApiKeyInvalid = errorMsg.includes('API key not valid') || errorMsg.includes('INVALID_ARGUMENT');
      
      if (isApiKeyInvalid) {
        setError({ message: 'A chave da API introduzida é inválida. Por favor, verifique a chave e tente novamente.' });
        localStorage.removeItem('GEMINI_API_KEY');
        setHasApiKey(false);
      } else {
        const isQuota = errorMsg.includes('429') || err?.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED');
        const isUnavailable = errorMsg.includes('503') || err?.status === 503 || errorMsg.includes('UNAVAILABLE');
        const isSpendingCap = errorMsg.toLowerCase().includes('spending cap') || errorMsg.toLowerCase().includes('billing');
        
        let message = errorMsg;
        
        // Se a mensagem for muito técnica ou vazia, usamos a padrão
        if (!message || message.includes('Unexpected token') || message.includes('[object Object]') || message.length > 300) {
          message = 'Erro ao processar o documento. Verifique se o PDF é válido.';
        }

        if (isSpendingCap) {
          message = 'O limite de gastos (spending cap) do seu projeto Google Cloud foi atingido. Verifique as configurações de faturação na Google Cloud Console ou utilize uma chave com limites superiores.';
        } else if (isQuota) {
          message = 'Limite de quota excedido ou muitas solicitações. Por favor, aguarde um momento ou verifique os limites da sua conta.';
        } else if (isUnavailable) {
          message = 'O serviço está temporariamente indisponível devido a alta procura. Por favor, tente novamente dentro de alguns instantes.';
        }

        setError({ 
          message,
          isQuota: isQuota || isUnavailable
        });
      }
    } finally {
      setIsProcessing(false);
      setProcessingStep(null);
    }
  };

  const handleSaveProject = () => {
    if (!analysis) return;
    const projectData = { ...analysis, _rawText: rawText, chatHistory: chatHistory };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Citius_${analysis.numero_processo.replace(/\//g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportZip = async () => {
    if (!analysis || !file) {
      if (!file) {
        alert("Por favor, vincule o PDF original para exportar os documentos.");
        relinkPdfInputRef.current?.click();
      }
      return;
    }

    try {
      setIsExporting(true);
      const zip = new JSZip();
      const existingPdfBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      for (const doc of analysis.documentos) {
        const newPdf = await PDFDocument.create();
        const start = doc.pagina_inicial - 1; // 0-indexed
        const end = doc.pagina_final - 1; // 0-indexed
        
        if (start < 0 || end >= pdfDoc.getPageCount()) {
          console.warn(`Invalid page range for doc ${doc.id_documento}: ${start}-${end}`);
          continue;
        }

        const pagesToCopy = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const copiedPages = await newPdf.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        
        // Nome: [nome do ato].[ref do ato].[ref documento].[descrição do documento]
        const sanitize = (str: string) => (str || '').replace(/[\\/:*?"<>|]/g, '_').trim();
        const fileName = `${sanitize(doc.tipo_documento_principal)}.${sanitize(doc.ref_ato)}.${sanitize(doc.ref_documento)}.${sanitize(doc.titulo_resumido)}.pdf`;
        
        zip.file(fileName, pdfBytes);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Dossier_${analysis.numero_processo.replace(/\//g, '_')}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erro ao exportar o dossier. Verifique se o PDF original está acessível.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.documentos) {
          setAnalysis(json);
          if (json._rawText) setRawText(json._rawText);
          if (json.chatHistory) setChatHistory(json.chatHistory);
          setFile(null); 
          setError(null);
        }
      } catch (err) {
        setError({ message: 'Erro ao ler o ficheiro JSON.' });
      }
    };
    reader.readAsText(selectedFile);
    e.target.value = '';
  };

  const groupedDocs = useMemo(() => {
    if (!analysis) return [];
    const query = searchQuery.toLowerCase();
    
    let baseDocs = analysis.documentos.filter(doc => {
      const titulo = (doc.titulo_resumido || '').toLowerCase();
      const sumario = (doc.sumario || '').toLowerCase();
      const apresentante = (doc.parte_apresentante || '').toLowerCase();
      const refAto = (doc.ref_ato || '');
      const refDoc = (doc.ref_documento || '');

      const matchesSearch = 
        titulo.includes(query) ||
        sumario.includes(query) ||
        apresentante.includes(query) ||
        refAto.includes(searchQuery) ||
        refDoc.includes(searchQuery);
      
      const matchesFilter = activeFilter === 'all' || doc.tipo_documento_principal === activeFilter;
      return matchesSearch && matchesFilter;
    });

    if (sortOrder === 'alphabetical') {
      baseDocs.sort((a, b) => (a.titulo_resumido || '').localeCompare(b.titulo_resumido || ''));
    } else if (sortOrder === 'chronological') {
      baseDocs.sort((a, b) => (a.pagina_inicial || 0) - (b.pagina_inicial || 0));
    } else {
      // Default: Index order
      baseDocs.sort((a, b) => (a.indexOrder || 0) - (b.indexOrder || 0));
    }

    const groups: { refAto: string, docs: DocumentMetadata[] }[] = [];
    
    // Grouping logic: Group by ref_ato but preserve the order of appearance
    // If ref_ato is missing, we try to keep it in the same group if the type matches or it's a continuation
    baseDocs.forEach(doc => {
      const ref = doc.ref_ato || 'Sem Ref';
      const type = doc.tipo_documento_indice || 'Outro';
      const lastGroup = groups[groups.length - 1];
      
      // If same ref, definitely same group
      // If ref is missing but it's the same type as the last group, keep it together
      const isSameRef = lastGroup && lastGroup.refAto === ref && ref !== 'Sem Ref';
      const isContinuation = lastGroup && ref === 'Sem Ref' && lastGroup.docs[0].tipo_documento_indice === type;

      if (isSameRef || isContinuation) {
        lastGroup.docs.push(doc);
      } else {
        groups.push({
          refAto: ref,
          docs: [doc]
        });
      }
    });

    return groups;
  }, [analysis, searchQuery, activeFilter, sortOrder]);

  const docTypes = useMemo(() => {
    if (!analysis) return [];
    return Array.from(new Set(analysis.documentos.map(d => d.tipo_documento_principal).filter(Boolean))).sort();
  }, [analysis]);

  const incidentSiblings = useMemo(() => {
    if (!selectedDoc || !analysis) return [];
    return analysis.documentos.filter(d => d.ref_ato === selectedDoc.ref_ato);
  }, [selectedDoc, analysis]);

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (hasApiKey === false) {
    const isExternal = typeof window !== 'undefined' && !(window as any).aistudio;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md space-y-8 text-center animate-in fade-in duration-500">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-3xl shadow-xl mb-4">
            <Key className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black tracking-tight uppercase">Configuração</h1>
            <p className="text-slate-500 font-medium leading-relaxed">
              {isExternal 
                ? "Para utilizar esta aplicação, introduza a sua própria chave da API do Gemini."
                : "Para utilizar as funcionalidades avançadas de IA do Citius Pro, é necessário selecionar uma chave da API do Gemini."}
            </p>
            
            {isExternal ? (
              <div className="space-y-4">
                <form onSubmit={handleManualKeySubmit} className="space-y-4">
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      placeholder="Cole aqui a sua chave da API (AIza...)" 
                      value={manualApiKey}
                      onChange={(e) => setManualApiKey(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                    />
                  </div>
                  {error && (
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-tight">
                      {error.message}
                    </p>
                  )}
                  <button 
                    type="submit"
                    disabled={!manualApiKey.trim()}
                    className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    Utilizar Minha Chave
                  </button>
                </form>

                <p className="text-[10px] text-slate-400 font-medium">
                  A chave será guardada localmente no seu navegador.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left">
                <p className="text-[11px] font-black text-blue-800 uppercase tracking-widest mb-2">Nota Importante:</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Deve selecionar uma chave de um projeto Google Cloud com faturação ativa. Consulte a documentação de faturação para mais detalhes.
                </p>
              </div>
            )}
          </div>
          {!isExternal && (
            <button 
              onClick={handleOpenKeySelection}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              <Key className="w-4 h-4" /> Selecionar Chave da API
            </button>
          )}
          {error && <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-100">{error.message}</div>}
        </div>
      </div>
    );
  }

  if (!analysis && !isProcessing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg mb-4">
              <Gavel className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight">Citius Analytics Pro</h1>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200">
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragging ? 'border-blue-600 bg-blue-100' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
              {file ? (
                <div className="text-center">
                  <FileText className="w-12 h-12 text-blue-600 mb-2 mx-auto" />
                  <h3 className="font-black text-slate-900">{file.name}</h3>
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <FileUp className="w-12 h-12 mb-2 mx-auto" />
                  <p className="font-bold">Clique ou arraste o PDF para análise</p>
                </div>
              )}
            </div>
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-100 space-y-3">
                <p>{error.message}</p>
                {error.isQuota && (
                  <button 
                    onClick={handleAnalyze}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Tentar Novamente
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={handleAnalyze} disabled={!file} className="py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:opacity-50 uppercase tracking-widest text-xs shadow-xl shadow-blue-100">
                Analisar Processo
              </button>
              <button onClick={() => jsonInputRef.current?.click()} className="py-4 bg-white border border-slate-200 text-slate-700 font-black rounded-2xl hover:bg-slate-50 uppercase tracking-widest text-xs">
                Recuperar Projeto
              </button>
              <input type="file" ref={jsonInputRef} className="hidden" accept=".json" onChange={handleLoadProject} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-8">
        <div className="relative">
          <div className="w-20 h-20 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
          <Gavel className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            {processingStep === 'extracting' ? 'Lendo PDF' : 
             processingStep === 'analyzing' ? 'IA mapeando índice' : 'Gerando Previews Instantâneos'}
          </h2>
          {processingStep === 'snapshots' && (
            <div className="w-64 bg-slate-200 h-2 rounded-full mt-4 overflow-hidden mx-auto">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(snapshotProgress.current / snapshotProgress.total) * 100}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <Gavel className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Citius Pro</h1>
            <p className="text-[10px] text-slate-400 font-bold leading-none">{analysis?.numero_processo}</p>
          </div>
        </div>
        <div className="flex-1 max-w-xl mx-8 relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" placeholder="Filtrar cronologia..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-xs transition-all border font-medium" />
          </div>
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="bg-slate-50 border-transparent rounded-xl px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 focus:bg-white focus:border-blue-500 outline-none border transition-all cursor-pointer"
          >
            <option value="index">Índice</option>
            <option value="chronological">Página</option>
            <option value="alphabetical">Nome</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          {!(window as any).aistudio && (
            <button 
              onClick={() => {
                if (confirm('Deseja alterar a chave da API? A chave atual será removida.')) {
                  localStorage.removeItem('GEMINI_API_KEY');
                  setHasApiKey(false);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"
              title="Alterar Chave da API"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Alterar Chave</span>
            </button>
          )}
          <button onClick={handleSaveProject} className="flex items-center space-x-2 px-4 py-2 text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
            <Download className="w-3.5 h-3.5" /> <span className="hidden md:inline">Guardar JSON</span>
          </button>
          <button 
            onClick={handleExportZip} 
            disabled={isExporting}
            className="flex items-center space-x-2 px-4 py-2 text-[10px] font-black uppercase bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isExporting ? 'A processar...' : 'Exportar ZIP'}</span>
          </button>
          <button onClick={() => { setAnalysis(null); setFile(null); }} className="px-4 py-2 text-[10px] font-black uppercase bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Novo</button>
        </div>
      </header>

      {!file && analysis && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 text-[10px] font-black uppercase tracking-tight">
            <AlertTriangle className="w-4 h-4" /> PDF original não vinculado.
          </div>
          <button onClick={() => relinkPdfInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1 bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-amber-700 transition-colors">
            <Paperclip className="w-3.5 h-3.5" /> Vincular PDF
          </button>
          <input type="file" ref={relinkPdfInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r hidden lg:flex flex-col p-6 space-y-8 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Filtrar</h3>
            <div className="space-y-1">
              <button onClick={() => setActiveFilter('all')} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase ${activeFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Todos</button>
              {docTypes.map(type => (
                <button key={type} onClick={() => setActiveFilter(type)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase ${activeFilter === type ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{type}</button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit mb-8">
              <button onClick={() => setActiveTab('timeline')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'timeline' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Timeline</button>
              <button onClick={() => setActiveTab('assistant')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'assistant' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Assistente</button>
            </div>

            {analysis?.isTruncated && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight mb-1">Análise Parcial Detectada</h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                    O dossier é muito extenso e a resposta da IA foi interrompida. Os documentos apresentados são apenas uma parte do processo total.
                    Tente analisar o PDF em partes menores ou verifique se o índice está completo.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'timeline' ? (
              <div className="space-y-2">
                {groupedDocs.map((group, gIdx) => (
                  <DocumentGroup 
                    key={`${group.refAto}-${gIdx}`} 
                    refAto={group.refAto} 
                    documents={group.docs} 
                    onDocumentClick={(doc) => {
                      setSelectedDoc(doc);
                      setSelectedSubDocPage(undefined);
                    }}
                    onSubDocClick={(doc, sub) => {
                      setSelectedDoc(doc);
                      setSelectedSubDocPage(sub.pagina_pdf);
                    }}
                  />
                ))}
              </div>
            ) : (
              <AssistantView 
                documents={analysis!.documentos} 
                file={file} 
                rawText={rawText} 
                chatHistory={chatHistory} 
                setChatHistory={setChatHistory} 
                onFileLink={(f) => setFile(f)}
                onDocumentSelect={setSelectedDoc}
                onApiKeyInvalid={() => {
                  localStorage.removeItem('GEMINI_API_KEY');
                  setHasApiKey(false);
                  setError({ message: 'A chave da API introduzida é inválida. Por favor, reintroduza a chave.' });
                }}
              />
            )}
          </div>
        </main>
      </div>

      {selectedDoc && (
        <DocumentDetail 
          doc={selectedDoc} 
          file={file} 
          initialPage={selectedSubDocPage}
          onClose={() => {
            setSelectedDoc(null);
            setSelectedSubDocPage(undefined);
          }}
          siblings={incidentSiblings}
          onSelectSibling={(sibling) => {
            setSelectedDoc(sibling);
            setSelectedSubDocPage(undefined);
          }}
          onFileRelink={(f) => setFile(f)}
        />
      )}
    </div>
  );
};

export default App;
