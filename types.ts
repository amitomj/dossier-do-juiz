
export enum DocumentType {
  DESPACHO_JUIZ = 'Despacho do juiz',
  SENTENCA_ACORDAO = 'Sentença/acórdão',
  DESPACHO_PARECER_MP = 'Despacho/parecer do Ministério Público',
  FORMULARIO_CITIUS = 'Formulário Citius',
  ALEGACOES_RECURSO = 'Alegações de recurso',
  CONTRA_ALEGACOES = 'Contra-alegações',
  REQUERIMENTO = 'Requerimento',
  PETICAO_INICIAL = 'Petição inicial',
  CONTESTACAO = 'Contestação',
  PROCURACAO = 'Procuração',
  DUC = 'DUC (Documento Único de Cobrança)',
  COMPROVATIVO_PAGAMENTO = 'Comprovativo de pagamento',
  CONTRATO_TRABALHO = 'Contrato de trabalho',
  FATURA = 'Factura/fatura',
  ATA_JULGAMENTO = 'Ata de julgamento',
  OUTRO = 'Outro'
}

export type SortOrder = 'chronological' | 'alphabetical' | 'index';

export interface TokenMetrics {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface Citation {
  ref_documento: string;
  pagina: number;
  titulo: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  metrics?: TokenMetrics;
  timestamp: number;
}

export interface SubDocument {
  id: string;
  titulo: string;
  descricao: string;
  pagina_pdf: number;
  numero_documento_manuscrito?: string;
}

export interface DocumentMetadata {
  id_documento: string;
  numero_processo: string;
  ref_ato: string;        
  ref_documento: string;  
  ref_formulario?: string;
  tipo_documento_principal: DocumentType;
  tipo_documento_indice: string;
  parte_apresentante: string;
  mandatario?: string;
  pagina_inicial: number;
  pagina_final: number;
  titulo_resumido: string;
  sumario: string;
  texto_integral: string;
  snapshot?: string; // Imagem Base64 da primeira página
  data_documento?: string;
  numero_documento_manuscrito?: string;
  sub_documentos?: SubDocument[];
  indexOrder: number;
  campos_especificos: Record<string, any>;
}

export interface ProcessAnalysis {
  numero_processo: string;
  tribunal: string;
  juizo: string;
  documentos: DocumentMetadata[];
  metrics?: TokenMetrics;
  chatHistory?: ChatMessage[];
  isTruncated?: boolean;
}
