// =====================================================
// Tipos para Sistema de Histórico de Clientes
// =====================================================

export interface HistoricoCliente {
  id: string;
  cliente_id: string;
  versao: number;
  dados_anteriores: Record<string, any> | null;
  dados_novos: Record<string, any> | null;
  campos_alterados: string[];
  tipo_operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  usuario_id: string | null;
  usuario_nome?: string;
  ip_address?: string;
  user_agent?: string;
  motivo_alteracao?: string;
  data_alteracao: string;
}

export interface ConfiguracaoAuditoriaClientes {
  id: string;
  lojista_id: string;
  dias_retencao: number;
  max_versoes_por_cliente: number;
  campos_auditados: string[];
  notificar_alteracoes: boolean;
  emails_notificacao: string[];
  data_criacao: string;
  data_atualizacao: string;
}

export interface ComparacaoVersoes {
  campo: string;
  valor_anterior: any;
  valor_novo: any;
  tipo_alteracao: 'ADICIONADO' | 'REMOVIDO' | 'ALTERADO';
}

export interface EstatisticasHistorico {
  total_alteracoes: number;
  alteracoes_hoje: number;
  alteracoes_semana: number;
  alteracoes_mes: number;
  usuarios_mais_ativos: Array<{
    usuario_id: string;
    usuario_nome: string;
    total_alteracoes: number;
  }>;
  campos_mais_alterados: Array<{
    campo: string;
    total_alteracoes: number;
  }>;
}

export interface FiltrosHistorico {
  cliente_id?: string;
  usuario_id?: string;
  tipo_operacao?: 'INSERT' | 'UPDATE' | 'DELETE';
  data_inicio?: string;
  data_fim?: string;
  campos_alterados?: string[];
  limite?: number;
  offset?: number;
}

export interface HistoricoClienteDetalhado extends HistoricoCliente {
  cliente_nome: string;
  alteracoes_formatadas: Array<{
    campo: string;
    label: string;
    valor_anterior: string;
    valor_novo: string;
    tipo_alteracao: string;
  }>;
}

export interface ResumoAlteracao {
  campo: string;
  label: string;
  valor_anterior: any;
  valor_novo: any;
  formatado_anterior: string;
  formatado_novo: string;
}

export interface ConfiguracaoVisualizacao {
  mostrar_dados_sensiveis: boolean;
  campos_mascarados: string[];
  formato_data: 'relativo' | 'absoluto';
  agrupar_por: 'data' | 'usuario' | 'tipo_operacao';
  itens_por_pagina: number;
}

// Tipos para componentes React
export interface HistoricoClienteProps {
  clienteId: string;
  mostrarFiltros?: boolean;
  altura?: string;
  onVersaoSelecionada?: (versao: number) => void;
}

export interface ComparadorVersoesProps {
  clienteId: string;
  versaoAnterior: number;
  versaoNova: number;
  onFechar: () => void;
}

export interface FiltroHistoricoProps {
  filtros: FiltrosHistorico;
  onFiltrosChange: (filtros: FiltrosHistorico) => void;
  onLimpar: () => void;
}

export interface TimelineHistoricoProps {
  historico: HistoricoCliente[];
  onComparar: (versao1: number, versao2: number) => void;
  configuracao: ConfiguracaoVisualizacao;
}

// Tipos para hooks
export interface UseHistoricoClienteReturn {
  historico: HistoricoCliente[];
  loading: boolean;
  error: string | null;
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  carregarHistorico: (filtros?: FiltrosHistorico) => Promise<void>;
  carregarMais: () => Promise<void>;
  recarregar: () => Promise<void>;
  irParaPagina: (pagina: number) => Promise<void>;
}

export interface UseComparacaoVersoesReturn {
  comparacao: ComparacaoVersoes[];
  loading: boolean;
  error: string | null;
  compararVersoes: (clienteId: string, versao1: number, versao2: number) => Promise<void>;
  limparComparacao: () => void;
}

export interface UseEstatisticasHistoricoReturn {
  estatisticas: EstatisticasHistorico | null;
  loading: boolean;
  error: string | null;
  carregarEstatisticas: () => Promise<void>;
  recarregar: () => Promise<void>;
}

// Tipos para formatação e utilitários
export interface FormatadorCampo {
  campo: string;
  label: string;
  tipo: 'texto' | 'numero' | 'data' | 'email' | 'telefone' | 'cpf' | 'moeda' | 'boolean';
  mascara?: boolean;
  formatador?: (valor: any) => string;
}

export interface ConfiguracaoMascara {
  campo: string;
  tipo: 'parcial' | 'completa';
  caractere: string;
  inicio?: number;
  fim?: number;
}

// Constantes
export const TIPOS_OPERACAO = {
  INSERT: 'Criação',
  UPDATE: 'Atualização', 
  DELETE: 'Exclusão'
} as const;

export const CAMPOS_CLIENTE = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  cpf: 'CPF',
  endereco: 'Endereço',
  limite_credito: 'Limite de Crédito',
  status: 'Status',
  data_nascimento: 'Data de Nascimento',
  profissao: 'Profissão',
  renda_mensal: 'Renda Mensal',
  score_credito: 'Score de Crédito'
} as const;

export const CAMPOS_SENSIVEIS = [
  'cpf',
  'telefone',
  'endereco',
  'renda_mensal'
] as const;

export const CORES_OPERACAO = {
  INSERT: 'text-green-600 bg-green-50',
  UPDATE: 'text-blue-600 bg-blue-50',
  DELETE: 'text-red-600 bg-red-50'
} as const;

export const ICONES_OPERACAO = {
  INSERT: 'plus-circle',
  UPDATE: 'pencil-square',
  DELETE: 'trash'
} as const;