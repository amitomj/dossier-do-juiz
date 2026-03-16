
import React from 'react';
import { DocumentMetadata, DocumentType } from '../types';
import { TYPE_COLORS } from '../constants';
import { ChevronRight, User, Hash, FileCode, FileText, Library } from 'lucide-react';

interface DocumentCardProps {
  doc: DocumentMetadata;
  onClick: (doc: DocumentMetadata) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onClick }) => {
  const colorClass = TYPE_COLORS[doc.tipo_documento_principal] || 'bg-gray-100 text-gray-800 border-gray-200';

  const isJudicial = doc.tipo_documento_principal === DocumentType.DESPACHO_JUIZ || 
                    doc.tipo_documento_principal === DocumentType.SENTENCA_ACORDAO;
  const isMP = doc.tipo_documento_principal === DocumentType.DESPACHO_PARECER_MP;

  const getPersonLabel = () => {
    if (isJudicial) return "Juiz";
    if (isMP) return "Procurador";
    return "Apresentante";
  };

  const getPersonName = () => {
    if (isJudicial || isMP) return doc.mandatario || 'Não identificado';
    return doc.parte_apresentante;
  };

  const hasSubDocs = doc.sub_documentos && doc.sub_documentos.length > 0;

  return (
    <div 
      onClick={() => onClick(doc)}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-1 flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border tracking-wider w-fit ${colorClass}`}>
            {doc.tipo_documento_principal}
          </span>
          {hasSubDocs && (
            <span className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
              <Library className="w-3 h-3" /> Conteúdo Múltiplo ({doc.sub_documentos?.length})
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded border">
          Pág. {doc.pagina_inicial}
        </span>
      </div>
      
      <h3 className="text-[15px] font-bold text-gray-900 mb-4 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
        {doc.titulo_resumido}
      </h3>

      <div className="space-y-2 mb-4 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
        <div className="flex items-center text-[11px] text-gray-600">
          <FileText className="w-3.5 h-3.5 mr-2 text-slate-500" />
          <span className="truncate">Proc: <span className="font-black text-blue-800">{doc.numero_processo || 'N/D'}</span></span>
        </div>
        <div className="flex items-center text-[11px] text-gray-600">
          <Hash className="w-3.5 h-3.5 mr-2 text-blue-400" />
          <span>Ref. Ato: <span className="font-bold text-gray-900">{doc.ref_ato}</span></span>
        </div>
        <div className="flex items-center text-[11px] text-gray-600">
          <FileCode className="w-3.5 h-3.5 mr-2 text-indigo-400" />
          <span>Ref. Doc: <span className="font-bold text-gray-900">{doc.ref_documento}</span></span>
        </div>
        <div className="flex items-center text-[11px] text-gray-600">
          <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
          <span className="truncate">{getPersonLabel()}: <span className="font-bold text-gray-900">{getPersonName()}</span></span>
        </div>
      </div>

      <div className="flex-1">
        <p className="text-[11px] text-slate-600 line-clamp-3 italic leading-relaxed bg-slate-50/30 p-2 rounded border border-dashed border-slate-100">
          {doc.sumario}
        </p>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end items-center">
        <span className="text-[10px] font-bold text-blue-500 uppercase flex items-center group-hover:mr-1 transition-all">
          {hasSubDocs ? 'Explorar Anexos' : 'Ver Detalhes'} <ChevronRight className="w-3 h-3 ml-1" />
        </span>
      </div>
    </div>
  );
};
