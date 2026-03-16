
import React, { useMemo, useState, useRef } from 'react';
import { DocumentMetadata, DocumentType, SubDocument } from '../types';
import { X, FileSearch, Library, ExternalLink, Scale, ShieldCheck, User, Paperclip, AlertTriangle } from 'lucide-react';
import { TYPE_COLORS } from '../constants';
import { PdfPagePreview } from './PdfPagePreview';

interface DocumentDetailProps {
  doc: DocumentMetadata;
  file: File | null;
  onClose: () => void;
  siblings?: DocumentMetadata[];
  onSelectSibling: (doc: DocumentMetadata) => void;
  onFileRelink?: (file: File) => void;
}

export const DocumentDetail: React.FC<DocumentDetailProps> = ({ doc, file, onClose, siblings = [], onSelectSibling, onFileRelink }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'subdocs'>(doc.sub_documentos?.length ? 'subdocs' : 'preview');
  const colorClass = TYPE_COLORS[doc.tipo_documento_principal] || 'bg-gray-100 text-gray-800 border-gray-200';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPdf = (pageNumber?: number) => {
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    const fileUrl = URL.createObjectURL(file);
    const targetPage = pageNumber || doc.pagina_inicial;
    const win = window.open(`${fileUrl}#page=${targetPage}`, '_blank');
    if (win) win.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    if (newFile && onFileRelink) onFileRelink(newFile);
  };

  const getRoleLabel = () => {
    if (doc.parte_apresentante === "Tribunal") return "Juiz";
    if (doc.parte_apresentante === "Ministério Público") return "Procurador";
    return "Mandatário";
  };

  const getRoleIcon = () => {
    if (doc.parte_apresentante === "Tribunal") return <Scale className="w-3.5 h-3.5 mr-2 text-blue-500" />;
    if (doc.parte_apresentante === "Ministério Público") return <ShieldCheck className="w-3.5 h-3.5 mr-2 text-purple-500" />;
    return <User className="w-3.5 h-3.5 mr-2 text-slate-400" />;
  };

  const hasSiblings = useMemo(() => siblings.length > 1, [siblings]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/20">
        
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <div className="px-10 py-6 border-b flex items-center justify-between bg-gray-50/50">
            <div className="flex flex-col min-w-0 flex-1 mr-4">
              <span className={`w-fit px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-2 shadow-sm ${colorClass}`}>
                {doc.tipo_documento_principal}
              </span>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 truncate tracking-tight">
                {doc.titulo_resumido}
              </h2>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handleFileChange} />
              <button 
                onClick={() => handleOpenPdf()}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 ${
                  file ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                {file ? <FileSearch className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                <span>{file ? `Abrir Original (Pág. ${doc.pagina_inicial})` : 'Vincular PDF'}</span>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex px-10 bg-white border-b">
            <button onClick={() => setActiveTab('preview')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'preview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>
              Visualização (Pág. {doc.pagina_inicial})
            </button>
            {doc.sub_documentos && doc.sub_documentos.length > 0 && (
              <button onClick={() => setActiveTab('subdocs')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'subdocs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>
                Anexos ({doc.sub_documentos.length})
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden p-4 bg-slate-200 shadow-inner">
            <div className="h-full animate-in slide-in-from-left-4 duration-300">
              <PdfPagePreview file={file} pageNumber={doc.pagina_inicial} snapshot={doc.snapshot} />
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 bg-gray-50 border-l border-gray-100 p-8 overflow-y-auto space-y-8">
          <div>
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6">Dados da Peça</h3>
            <div className="space-y-5">
              <MetaItem label="Processo" value={doc.numero_processo || '---'} isHighlight />
              <MetaItem label="Ref. Ato" value={doc.ref_ato} isBadge />
              <MetaItem label="Ref. Doc" value={doc.ref_documento} isBadge />
              <MetaItem label="Apresentante" value={doc.parte_apresentante} />
              <MetaItem label={getRoleLabel()} value={doc.mandatario || '---'} icon={getRoleIcon()} />
              <MetaItem label="Localização" value={`Págs. ${doc.pagina_inicial} - ${doc.pagina_final || '?'}`} />
            </div>
          </div>

          {hasSiblings && (
            <div className="pt-8 border-t border-gray-200">
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Ato Completo</h3>
              <div className="space-y-2">
                {siblings.map((sibling) => (
                  <button
                    key={sibling.id_documento}
                    onClick={() => onSelectSibling(sibling)}
                    className={`w-full text-left p-3 rounded-xl text-[10px] font-bold border transition-all ${
                      sibling.id_documento === doc.id_documento 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="uppercase truncate">{sibling.tipo_documento_indice || sibling.tipo_documento_principal}</div>
                    <div className="text-[9px] opacity-70">Pág: {sibling.pagina_inicial}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetaItem = ({ label, value, isBadge, isHighlight, icon }: { label: string; value: string; isBadge?: boolean; isHighlight?: boolean, icon?: React.ReactNode }) => (
  <div className="group">
    <span className="text-[10px] font-black text-gray-400 uppercase flex items-center tracking-tight mb-1.5">
      {icon} {label}
    </span>
    <span className={`text-[12px] font-extrabold block leading-tight ${
      isBadge ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 w-fit' : 
      isHighlight ? 'text-blue-900 bg-white border border-blue-600/20 px-3 py-1.5 rounded-lg shadow-sm' : 
      'text-gray-900'
    }`}>
      {value || '---'}
    </span>
  </div>
);
