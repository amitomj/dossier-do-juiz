
import React from 'react';
import { DocumentMetadata, SubDocument } from '../types';
import { DocumentRow } from './DocumentRow';
import { Box, Layers } from 'lucide-react';

interface DocumentGroupProps {
  refAto: string;
  documents: DocumentMetadata[];
  onDocumentClick: (doc: DocumentMetadata) => void;
  onSubDocClick?: (doc: DocumentMetadata, subDoc: SubDocument) => void;
}

export const DocumentGroup: React.FC<DocumentGroupProps> = ({ refAto, documents, onDocumentClick, onSubDocClick }) => {
  // O tipo do ato costuma vir do índice original ou pode ser inferido da primeira peça não-formulário
  const actType = documents.find(d => d.tipo_documento_indice !== 'Formulário')?.tipo_documento_indice || 'Incidente';

  return (
    <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center space-x-4 mb-4">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-100">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center">
            {actType} 
            <span className="mx-2 text-slate-300">|</span>
            <span className={`px-2 py-0.5 rounded-md border font-mono text-[11px] ${refAto === 'Sem Ref' ? 'bg-slate-50 text-slate-400 border-slate-100 italic' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
              {refAto === 'Sem Ref' ? 'Refª não visível no excerto' : `Refª ${refAto}`}
            </span>
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {documents.length} {documents.length === 1 ? 'peça associada' : 'peças associadas'}
          </p>
        </div>
      </div>
      
      <div className="ml-4 pl-8 border-l-2 border-slate-100 space-y-3 relative">
        {documents.map((doc, idx) => (
          <DocumentRow 
            key={`${doc.id_documento}-${doc.indexOrder}-${idx}`} 
            doc={doc} 
            onClick={() => onDocumentClick(doc)}
            onSubDocClick={(sub) => onSubDocClick?.(doc, sub)}
            isLast={idx === documents.length - 1}
          />
        ))}
      </div>
    </div>
  );
};
