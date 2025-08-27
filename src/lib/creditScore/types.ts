// Tipos para o sistema de score de crédito

export type ScoreType = 'INICIAL' | 'RECALCULADO' | 'MANUAL' | 'AJUSTADO';

export type RiskClassification = 
  | 'MUITO_BAIXO' 
  | 'BAIXO' 
  | 'MEDIO' 
  | 'ALTO' 
  | 'MUITO_ALTO';

export interface CreditScore {
  id: string;
  cliente_id: string;
  lojista_id: string;
  score_valor: number;
  classificacao_risco: RiskClassification;
  tipo_score: ScoreType;
  fatores_positivos: string[];
  fatores_negativos: string[];
  
  // Detalhes do cálculo
  historico_pagamentos_score: number;
  utilizacao_limite_score: number;
  tempo_relacionamento_score: number;
  diversidade_transacoes_score: number;
  comportamento_recente_score: number;
  
  // Metadados
  algoritmo_versao: string;
  observacoes?: string;
  score_anterior?: number;
  variacao_score?: number;
  
  // Validade
  valido_ate: string;
  recalcular_em?: string;
  bloqueado: boolean;
  motivo_bloqueio?: string;
  
  // Auditoria
  calculado_por?: string;
  calculado_em: string;
  created_at: string;
  updated_at: string;
}

export interface ScoreHistory {
  id: string;
  score_id: string;
  cliente_id: string;
  score_valor: number;
  classificacao_risco: RiskClassification;
  tipo_score: ScoreType;
  algoritmo_versao: string;
  motivo_alteracao?: string;
  alterado_por?: string;
  data_alteracao: string;
}

export interface ScoreConfig {
  id: string;
  lojista_id: string;
  
  // Pesos dos fatores
  peso_historico_pagamentos: number;
  peso_utilizacao_limite: number;
  peso_tempo_relacionamento: number;
  peso_diversidade_transacoes: number;
  peso_comportamento_recente: number;
  
  // Configurações de recálculo
  recalculo_automatico: boolean;
  frequencia_recalculo_dias: number;
  
  // Limites de classificação
  limite_muito_baixo: number;
  limite_baixo: number;
  limite_medio: number;
  limite_alto: number;
  
  // Configurações de alertas
  alertar_score_baixo: boolean;
  alertar_variacao_significativa: boolean;
  variacao_significativa_pontos: number;
  
  created_at: string;
  updated_at: string;
}

export interface ScoreCalculationResult {
  score: number;
  classification: RiskClassification;
  factors: {
    positive: string[];
    negative: string[];
  };
  breakdown: {
    historico_pagamentos: number;
    utilizacao_limite: number;
    tempo_relacionamento: number;
    diversidade_transacoes: number;
    comportamento_recente: number;
  };
}

export interface ScoreAlert {
  type: 'LOW_SCORE' | 'SIGNIFICANT_CHANGE' | 'EXPIRED_SCORE';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  cliente_id: string;
  score_atual?: number;
  score_anterior?: number;
  variacao?: number;
}

export interface ScoreFilters {
  classificacao_risco?: RiskClassification[];
  score_min?: number;
  score_max?: number;
  valido?: boolean;
  bloqueado?: boolean;
  data_inicio?: string;
  data_fim?: string;
}

export interface ScoreStats {
  total_clientes: number;
  score_medio: number;
  distribuicao_risco: Record<RiskClassification, number>;
  tendencia_mensal: Array<{
    mes: string;
    score_medio: number;
    total_clientes: number;
  }>;
  alertas_ativos: number;
}