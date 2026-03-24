
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocumentMetadata, ProcessAnalysis, SortOrder, TokenMetrics, ChatMessage } from './types';
import { analyzeProcessText } from './services/geminiService';
import { extractTextFromPdf, getPageSnapshot, getPdfDocument } from './services/pdfService';
import { DocumentGroup } from './components/DocumentGroup';
import { DocumentDetail } from './components/DocumentDetail';
import { AssistantView } from './components/AssistantView';
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
  Paperclip
} from 'lucide-react';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>(''); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'extracting' | 'analyzing' | 'snapshots' | null>(null);
  const [snapshotProgress, setSnapshotProgress] = useState({ current: 0, total: 0 });
  const [analysis, setAnalysis] = useState<ProcessAnalysis | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('chronological');
  const [error, setError] = useState<{ message: string; isQuota?: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'assistant'>('timeline');
  
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
        // For external deployments (Vercel, etc.), check if the key is already defined via env vars
        const isKeyPresent = !!(process.env.API_KEY || process.env.GEMINI_API_KEY);
        setHasApiKey(isKeyPresent);
      }
    };
    checkApiKey();
  }, []);

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
      setError({ message: 'Para utilizar esta app fora do AI Studio (ex: Vercel), deve configurar a variável de ambiente GEMINI_API_KEY nas definições do seu projeto.' });
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
      const extractedText = await extractTextFromPdf(file);
      const pdf = await getPdfDocument(file);
      const totalPages = pdf.numPages;
      setRawText(extractedText);
      
      setProcessingStep('analyzing');
      const result = await analyzeProcessText(extractedText);
      
      // ORDENAÇÃO E PÓS-PROCESSAMENTO PARA GARANTIR PÁGINAS FINAIS
      const sortedDocs = [...result.documentos].sort((a, b) => a.pagina_inicial - b.pagina_inicial);
      
      for (let i = 0; i < sortedDocs.length; i++) {
        const doc = sortedDocs[i];
        
        // Garante o número do processo em cada doc
        doc.numero_processo = result.numero_processo;

        // Calcula página final baseando-se no próximo documento
        if (i < sortedDocs.length - 1) {
          doc.pagina_final = sortedDocs[i + 1].pagina_inicial - 1;
        } else {
          doc.pagina_final = totalPages;
        }
      }

      setProcessingStep('snapshots');
      setSnapshotProgress({ current: 0, total: sortedDocs.length });
      
      for (let i = 0; i < sortedDocs.length; i++) {
        const doc = sortedDocs[i];
        try {
          doc.snapshot = await getPageSnapshot(file, doc.pagina_inicial);
        } catch (e) {
          console.warn(`Snapshot failed for doc ${doc.id_documento}`);
        }
        setSnapshotProgress(prev => ({ ...prev, current: i + 1 }));
      }

      setAnalysis({ ...result, documentos: sortedDocs });
      setChatHistory([]); 
    } catch (err: any) {
      console.error(err);
      const isQuota = err?.message?.includes('429') || err?.status === 429;
      setError({ 
        message: isQuota 
          ? 'Limite excedido. Configure a sua chave da API.' 
          : 'Erro ao processar o PDF. Tente novamente.',
        isQuota: isQuota
      });
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
    } else {
      baseDocs.sort((a, b) => (a.pagina_inicial || 0) - (b.pagina_inicial || 0));
    }

    const groups: { refAto: string, docs: DocumentMetadata[] }[] = [];
    const seenRefs = new Set<string>();

    baseDocs.forEach(doc => {
      const ref = doc.ref_ato || 'Sem Ref';
      if (!seenRefs.has(ref)) {
        seenRefs.add(ref);
        groups.push({
          refAto: ref,
          docs: baseDocs.filter(d => d.ref_ato === ref)
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
            <h1 className="text-3xl font-black tracking-tight uppercase">Configuração Necessária</h1>
            <p className="text-slate-500 font-medium leading-relaxed">
              {isExternal 
                ? "Para utilizar esta aplicação no Vercel, deve configurar a sua chave da API do Gemini."
                : "Para utilizar as funcionalidades avançadas de IA do Citius Pro, é necessário selecionar uma chave da API do Gemini."}
            </p>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left">
              <p className="text-[11px] font-black text-blue-800 uppercase tracking-widest mb-2">Nota Importante:</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                {isExternal 
                  ? "Adicione a variável de ambiente GEMINI_API_KEY no painel de controlo do Vercel e faça um novo deploy."
                  : "Deve selecionar uma chave de um projeto Google Cloud com faturação ativa. Consulte a documentação de faturação para mais detalhes."}
              </p>
            </div>
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
            {error && <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-100">{error.message}</div>}
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
        <div className="flex-1 max-w-xl mx-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input type="text" placeholder="Filtrar cronologia..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-xs transition-all border font-medium" />
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleSaveProject} className="flex items-center space-x-2 px-4 py-2 text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
            <Download className="w-3.5 h-3.5" /> <span className="hidden md:inline">Guardar JSON</span>
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

            {activeTab === 'timeline' ? (
              <div className="space-y-2">
                {groupedDocs.map(group => (
                  <DocumentGroup key={group.refAto} refAto={group.refAto} documents={group.docs} onDocumentClick={setSelectedDoc} />
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
              />
            )}
          </div>
        </main>
      </div>

      {selectedDoc && (
        <DocumentDetail doc={selectedDoc} file={file} onClose={() => setSelectedDoc(null)} siblings={incidentSiblings} onSelectSibling={setSelectedDoc} onFileRelink={(f) => setFile(f)} />
      )}
    </div>
  );
};

export default App;
