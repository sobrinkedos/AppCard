import { CreditScore, ScoreCalculationResult, RiskClassification } from './types';

export const demoScores: CreditScore[] = [
  {
    id: '1',
    cliente_id: '1',
    lojista_id: 'demo',
    score_valor: 650,
    classificacao_risco: 'MEDIO',
    score_anterior: 620,
    variacao_score: 30,
    fatores_positivos: ['Histórico de pagamentos em dia', 'Baixa utilização do limite'],
    fatores_negativos: ['Pouco tempo de relacionamento'],
    historico_pagamentos_score: 85,
    utilizacao_limite_score: 75,
    tempo_relacionamento_score: 45,
    diversidade_transacoes_score: 60,
    comportamento_recente_score: 70,
    valido_ate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    bloqueado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    cliente_id: '2',
    lojista_id: 'demo',
    score_valor: 450,
    classificacao_risco: 'BAIXO',
    score_anterior: 480,
    variacao_score: -30,
    fatores_positivos: ['Cliente há mais de 1 ano'],
    fatores_negativos: ['Atrasos recentes', 'Alta utilização do limite'],
    historico_pagamentos_score: 45,
    utilizacao_limite_score: 30,
    tempo_relacionamento_score: 80,
    diversidade_transacoes_score: 40,
    comportamento_recente_score: 35,
    valido_ate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    bloqueado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export function generateDemoScoreCalculation(clienteId: string): ScoreCalculationResult {
  const baseScore = Math.floor(Math.random() * 400) + 300; // 300-700
  
  return {
    score: baseScore,
    classification: getClassificationFromScore(baseScore),
    factors: {
      positive: [
        'Histórico de pagamentos consistente',
        'Baixa utilização do limite de crédito',
        'Relacionamento de longo prazo'
      ].slice(0, Math.floor(Math.random() * 3) + 1),
      negative: [
        'Atrasos ocasionais',
        'Alta utilização do limite',
        'Pouco tempo de relacionamento'
      ].slice(0, Math.floor(Math.random() * 2))
    },
    breakdown: {
      historico_pagamentos: Math.floor(Math.random() * 40) + 60,
      utilizacao_limite: Math.floor(Math.random() * 40) + 40,
      tempo_relacionamento: Math.floor(Math.random() * 50) + 30,
      diversidade_transacoes: Math.floor(Math.random() * 30) + 50,
      comportamento_recente: Math.floor(Math.random() * 40) + 45
    }
  };
}

function getClassificationFromScore(score: number): RiskClassification {
  if (score <= 200) return 'MUITO_BAIXO';
  if (score <= 400) return 'BAIXO';
  if (score <= 600) return 'MEDIO';
  if (score <= 800) return 'ALTO';
  return 'MUITO_ALTO';
}