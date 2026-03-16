
import React from 'react';
import { DocumentMetadata } from '../types';
import { TYPE_COLORS } from '../constants';
import { ChevronRight, User, Library, Scale, ShieldCheck } from 'lucide-react';

interface DocumentRowProps {
  doc: DocumentMetadata;
  onClick: () => void;
  isLast?: boolean;
}

export const DocumentRow: React.FC<DocumentRowProps> = ({ doc, onClick, isLast }) => {
  const colorClass = TYPE_COLORS[doc.tipo_documento_principal] || 'bg-gray-100 text-gray-800 border-gray-200';
  const hasSubDocs = doc.sub_documentos && doc.sub_documentos.length > 0;

  const getRoleIcon = () => {
    if (doc.parte_apresentante === "Tribunal") return <Scale className="w-3 h-3 mr-1 text-blue-500" />;
    if (doc.parte_apresentante === "Ministério Público") return <ShieldCheck className="w-3 h-3 mr-1 text-purple-500" />;
    return <User className="w-3 h-3 mr-1 text-slate-400" />;
  };

  const getRoleLabel = () => {
    if (doc.parte_apresentante === "Tribunal") return "Juiz";
    if (doc.parte_apresentante === "Ministério Público") return "Procurador";
    return "Apresentante";
  };

  const getDisplayName = () => {
    if (doc.parte_apresentante === "Tribunal" || doc.parte_apresentante === "Ministério Público") {
      return doc.mandatario || doc.parte_apresentante;
    }
    return doc.parte_apresentante || '---';
  };

  return (
    <div 
      onClick={onClick}
      className="group relative bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50 transition-all cursor-pointer flex items-center space-x-6"
    >
      <div className="absolute -left-[33px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-500 group-hover:scale-150 transition-all" />

      <div className="flex flex-col min-w-[140px] max-w-[140px]">
        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border tracking-wider text-center mb-1 truncate ${colorClass}`}>
          {doc.tipo_documento_principal}
        </span>
        <span className="text-[10px] font-bold text-slate-400 text-center">
          Ref Doc: {doc.ref_documento}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <h4 className="text-[14px] font-extrabold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
            {doc.titulo_resumido}
          </h4>
          {hasSubDocs && (
            <span className="flex items-center gap-1 text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase shrink-0">
              <Library className="w-2.5 h-2.5" /> +{doc.sub_documentos?.length} Anexos
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-1 italic">
          {doc.sumario}
        </p>
      </div>

      <div className="hidden xl:flex flex-col items-end min-w-[160px] border-l pl-6 border-slate-100">
        <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-0.5">
          {getRoleIcon()} {getRoleLabel()}
        </div>
        <span className="text-[11px] font-extrabold text-slate-700 truncate max-w-full">
          {getDisplayName()}
        </span>
      </div>

      <div className="flex items-center space-x-4 pl-6">
        <div className="text-right">
          <div className="text-[10px] font-black text-slate-400 uppercase leading-none">Pág.</div>
          <div className="text-sm font-black text-slate-900">{doc.pagina_inicial}</div>
        </div>
        <div className="p-2 bg-slate-50 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
