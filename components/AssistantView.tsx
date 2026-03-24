
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DocumentMetadata, ChatMessage, TokenMetrics } from '../types';
import { askAssistant } from '../services/geminiService';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  FileText, 
  ExternalLink, 
  Download, 
  Trash2,
  Cpu,
  ArrowRightCircle,
  Paperclip,
  AlertCircle
} from 'lucide-react';

interface AssistantViewProps {
  documents: DocumentMetadata[];
  file: File | null;
  rawText: string;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onFileLink?: (file: File) => void;
  onDocumentSelect?: (doc: DocumentMetadata) => void;
  onApiKeyInvalid?: () => void;
}

export const AssistantView: React.FC<AssistantViewProps> = ({ 
  documents, 
  file, 
  rawText, 
  chatHistory, 
  setChatHistory,
  onFileLink,
  onDocumentSelect,
  onApiKeyInvalid
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const docsContext = documents.map(d => 
        `Ref Doc: ${d.ref_documento} | Titulo: ${d.titulo_resumido} | Pagina: ${d.pagina_inicial}`
      ).join('\n');

      const result = await askAssistant(input, rawText, docsContext);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        citations: result.citations,
        metrics: result.metrics,
        timestamp: Date.now()
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error(error);
      const isApiKeyInvalid = error?.message?.includes('API key not valid') || error?.message?.includes('INVALID_ARGUMENT');
      
      if (isApiKeyInvalid && onApiKeyInvalid) {
        onApiKeyInvalid();
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: isApiKeyInvalid 
            ? "A chave da API introduzida é inválida. Por favor, reintroduza a chave." 
            : "Lamento, ocorreu um erro ao processar a sua pergunta. Verifique a ligação e tente novamente.",
          timestamp: Date.now()
        };
        setChatHistory(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDoc = (page: number, ref?: string) => {
    // Tenta primeiro abrir internamente se houver referência
    if (ref && onDocumentSelect) {
      const doc = documents.find(d => d.ref_documento === ref);
      if (doc) {
        onDocumentSelect(doc);
        return;
      }
    }

    // Fallback para abertura externa se não encontrar ou não houver ref
    if (!pdfUrl) {
      alert("Por favor, vincule o ficheiro PDF original para abrir as páginas.");
      fileInputRef.current?.click();
      return;
    }
    
    try {
      const win = window.open(`${pdfUrl}#page=${page}`, '_blank');
      if (!win) {
        alert("O navegador bloqueou a abertura do PDF. Por favor, permita popups para este site.");
      }
    } catch (e) {
      console.error("Erro ao abrir PDF:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    if (newFile && onFileLink) {
      onFileLink(newFile);
    }
  };

  const downloadToWord = (msg?: ChatMessage) => {
    let bodyHtml = "";
    
    if (msg) {
      const userContent = chatHistory.find(m => m.timestamp < msg.timestamp && m.role === 'user')?.content;
      bodyHtml = `
        <h3>PERGUNTA:</h3>
        <p>${userContent?.replace(/\n/g, '<br>')}</p>
        <hr/>
        <h3>RESPOSTA DO ASSISTENTE:</h3>
        <p>${msg.content.replace(/\n/g, '<br>')}</p>
        <h4>Documentos citados:</h4>
        <ul>
          ${msg.citations?.map(c => `<li>${c.titulo} (Ref: ${c.ref_documento}, Pág: ${c.pagina})</li>`).join('') || ''}
        </ul>
      `;
    } else {
      bodyHtml = chatHistory.map(m => {
        const role = m.role === 'user' ? 'UTILIZADOR' : 'ASSISTENTE';
        return `
          <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #eee;">
            <b style="color: #2563eb;">${role}:</b><br/>
            <p>${m.content.replace(/\n/g, '<br>')}</p>
            ${m.citations ? '<br/><b>CITAÇÕES:</b><ul>' + m.citations.map(c => `<li>${c.titulo} (Pág. ${c.pagina})</li>`).join('') + '</ul>' : ''}
          </div>
        `;
      }).join('');
    }

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                    <head><meta charset='utf-8'><title>Conversa Citius Pro</title>
                    <style>body { font-family: 'Inter', sans-serif; font-size: 11pt; }</style></head><body>`;
    const footer = "</body></html>";
    const fullContent = header + bodyHtml + footer;

    const blob = new Blob(['\ufeff' + fullContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = msg ? `Resposta_${msg.id}.doc` : `Conversa_Citius_Completa.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[75vh] bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
      <div className="bg-slate-900 px-8 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-white font-black text-sm uppercase tracking-wider">Assistente Jurídico Pro</h4>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${pdfUrl ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {pdfUrl ? 'PDF Vinculado' : 'PDF não detetado'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!pdfUrl && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all"
            >
              <Paperclip className="w-3.5 h-3.5" /> Vincular PDF
            </button>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
          
          <button 
            onClick={() => downloadToWord()}
            disabled={chatHistory.length === 0}
            className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
            title="Descarregar histórico para Word"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setChatHistory([])}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Limpar conversa"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
        {!pdfUrl && chatHistory.length > 0 && (
           <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-tight">Aviso de Contexto Visual</p>
                <p className="text-[12px] font-medium leading-relaxed">
                  Vincule o PDF original para abrir as páginas citadas pelo assistente.
                </p>
              </div>
           </div>
        )}

        {chatHistory.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center border-2 border-dashed border-blue-200">
              <Bot className="w-10 h-10 text-blue-300" />
            </div>
            <div>
              <h5 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-2">Como posso ajudar?</h5>
              <p className="text-[12px] font-bold text-slate-400 uppercase leading-relaxed">
                Faça perguntas sobre salários, datas ou decisões.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full">
              {["Qual o valor das custas?", "Quais os fundamentos do recurso?", "Identifique o salário do trabalhador."].map(hint => (
                <button 
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:border-blue-500 hover:text-blue-600 transition-all text-left flex items-center justify-between group"
                >
                  {hint}
                  <ArrowRightCircle className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'} space-x-4`}>
              <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm border ${
                msg.role === 'user' ? 'bg-white text-slate-900 border-slate-200' : 'bg-blue-600 text-white border-blue-500'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              
              <div className="space-y-3">
                <div className={`p-6 rounded-[2rem] shadow-sm border ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' 
                    : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
                }`}>
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.content}
                  </p>

                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-2">
                      {msg.citations.map((cite, idx) => (
                        <button 
                          key={idx}
                          onClick={() => handleOpenDoc(cite.pagina, cite.ref_documento)}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-black text-blue-700 hover:bg-blue-600 hover:text-white transition-all group"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{cite.titulo} (Pág. {cite.pagina})</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {msg.metrics && (
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                          <Cpu className="w-3 h-3 text-blue-500" />
                          {msg.metrics.totalTokens} Tokens
                        </span>
                      )}
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    
                    <button 
                      onClick={() => downloadToWord(msg)}
                      className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center"
                    >
                      <Download className="w-3 h-3 mr-1" /> Exportar Word
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white p-6 rounded-[2rem] rounded-tl-none border border-slate-100 shadow-sm flex items-center space-x-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">A ler o processo...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        <div className="relative max-w-4xl mx-auto flex items-end space-x-4">
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Faça uma pergunta sobre o processo..."
              className="w-full pl-6 pr-14 py-4 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 rounded-[1.5rem] text-[14px] font-medium transition-all border shadow-inner resize-none overflow-hidden"
              style={{ minHeight: '56px', maxHeight: '150px' }}
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-30 transition-all shrink-0"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
