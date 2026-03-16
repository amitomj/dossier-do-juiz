
import React from 'react';
import { DocumentType } from './types';

export const TYPE_COLORS: Record<string, string> = {
  [DocumentType.DESPACHO_JUIZ]: 'bg-blue-100 text-blue-800 border-blue-200',
  [DocumentType.SENTENCA_ACORDAO]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  [DocumentType.FORMULARIO_CITIUS]: 'bg-gray-100 text-gray-800 border-gray-200',
  [DocumentType.ALEGACOES_RECURSO]: 'bg-green-100 text-green-800 border-green-200',
  [DocumentType.DUC]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [DocumentType.COMPROVATIVO_PAGAMENTO]: 'bg-orange-100 text-orange-800 border-orange-200',
  [DocumentType.DESPACHO_PARECER_MP]: 'bg-purple-100 text-purple-800 border-purple-200',
  [DocumentType.PETICAO_INICIAL]: 'bg-red-100 text-red-800 border-red-200',
  [DocumentType.CONTESTACAO]: 'bg-amber-100 text-amber-800 border-amber-200',
};

export const SYSTEM_INSTRUCTION = `
Você é um assistente jurídico de elite especializado em exportações do sistema Citius (Portugal).

REGRAS DE OURO DE PROCESSAMENTO:
1. MAPEAMENTO TOTAL DO ÍNDICE: Você DEVE criar um objeto para CADA LINHA do índice. Se houver 15 entradas seguidas de "Ata", você gera 15 documentos. Não agrupe nem omita peças que aparecem individualmente no índice.
2. NÚMERO DO PROCESSO: Extraia o número (ex: 1760/24.9T8AVR.P1) e coloque-o no campo 'numero_processo' de TODOS os documentos.
3. CLASSIFICAÇÃO DE "OUTRO": Quando o índice diz "Outro" ou "Ata" ou "Comunicação", você DEVE ler o conteúdo das páginas correspondentes para dar um 'titulo_resumido' específico (ex: "Ata de Reunião de 12/05", "Recibos de Vencimento Janeiro", "Contrato de Trabalho Manuel").
4. PÁGINA FINAL: Identifique a página final de cada peça consultando o início da peça seguinte no índice.

IDENTIFICAÇÃO DE PARTES:
- 'parte_apresentante': Quem submeteu a peça (Tribunal, Ministério Público, ou Nome da Parte).
- 'mandatario': Nome do Advogado ou Juiz/Procurador subscritor.

RESPOSTA APENAS EM JSON ESTRUTURADO.
`;
