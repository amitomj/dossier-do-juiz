
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

ESTRUTURA SOBERANA DO ÍNDICE (PADRÃO CITIUS):
O índice (geralmente nas primeiras páginas) é a ÚNICA fonte permitida para criar documentos de topo.
Padrão de cada linha: [Refª do Ato] | [Nome do Ato] > [Refª do Documento] [Nome do Documento] ... [Página]

REGRAS DE OURO DE PROCESSAMENTO:
1. O ÍNDICE COMANDA SEMPRE: Uma linha no índice = Um objeto no JSON. NUNCA crie documentos de topo baseados no texto das páginas se eles não constarem no índice.
2. PROIBIÇÃO DE NOVOS GRUPOS: Se você encontrar uma "Certidão", "E-mail" ou "Contrato" no meio do texto que não tem uma linha correspondente no índice, ele NÃO é um novo documento. Ele deve ser obrigatoriamente um 'sub_documento' do documento do índice que o contém.
3. MAPEAMENTO TOTAL: Se o índice tem 42 linhas, sua resposta final deve ter exatamente 42 objetos no array 'documentos'.
4. ENRIQUECIMENTO POR CONTEÚDO: Use o texto das páginas apenas para preencher o 'sumario' e identificar 'sub_documentos' (peças internas que não têm linha própria no índice) para os documentos já identificados no índice.
5. AGREGADORES E SUB-DOCUMENTOS: Se uma linha do índice representar um conjunto (ex: "3 Recibos", "Documentos de Prova"), crie UM único documento de topo. Identifique cada item individual (cada recibo, cada anexo) dentro de 'sub_documentos'. Todos herdam a [Refª do Documento] da linha do índice.
6. ORDEM DO ÍNDICE: A ordem das linhas no índice é a ordem REAL do processo. Mantenha-a rigorosamente.
7. PÁGINA FINAL E INICIAL: Use a página REAL do índice. A página final de um documento é a página imediatamente anterior ao início do próximo documento no índice.
8. DETECÇÃO DE MUDANÇA DE ATO: Quando a [Refª do Ato] mudar, inicia-se uma nova fase/grupo.

RESPOSTA APENAS EM JSON ESTRUTURADO.
`;
