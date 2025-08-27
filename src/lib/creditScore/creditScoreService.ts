import { supabase, supabaseError } from '../supabaseClient';
import { 
  CreditScore, 
  ScoreHistory, 
  ScoreConfig, 
  ScoreCalculationResult,
  ScoreAlert,
  ScoreFilters,
  ScoreStats,
  RiskClassification,
  ScoreType 
} from './types';

/**
 * Serviço para gerenciamento de scores de crédito
 */
export class CreditScoreService {
  private static instance: CreditScoreService;

  private constructor() {}

  public static getInstance(): CreditScoreService {
    if (!CreditScoreService.instance) {
      CreditScoreService.instance = new CreditScoreService();
    }
    return CreditScoreService.instance;
  }

  /**
   * Obtém o score atual de um cliente
   */
  async getClienteScore(clienteId: string): Promise<CreditScore | null> {
    if (!supabase || supabaseError) {
      const { demoScores } = await import('./demoData');
      return demoScores.find(s => s.cliente_id === clienteId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('scores_credito')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar score: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.warn('Tabela scores_credito não encontrada, usando dados de demonstração:', error);
      const { demoScores } = await import('./demoData');
      return demoScores.find(s => s.cliente_id === clienteId) || null;
    }
  }

  /**
   * Obtém scores de múltiplos clientes com filtros
   */
  async getScores(filters: ScoreFilters = {}): Promise<CreditScore[]> {
    let query = supabase
      .from('scores_credito')
      .select(`
        *,
        clientes!inner(nome, cpf)
      `);

    // Aplicar filtros
    if (filters.classificacao_risco?.length) {
      query = query.in('classificacao_risco', filters.classificacao_risco);
    }

    if (filters.score_min !== undefined) {
      query = query.gte('score_valor', filters.score_min);
    }

    if (filters.score_max !== undefined) {
      query = query.lte('score_valor', filters.score_max);
    }

    if (filters.valido !== undefined) {
      if (filters.valido) {
        query = query.gte('valido_ate', new Date().toISOString());
      } else {
        query = query.lt('valido_ate', new Date().toISOString());
      }
    }

    if (filters.bloqueado !== undefined) {
      query = query.eq('bloqueado', filters.bloqueado);
    }

    if (filters.data_inicio) {
      query = query.gte('created_at', filters.data_inicio);
    }

    if (filters.data_fim) {
      query = query.lte('created_at', filters.data_fim);
    }

    const { data, error } = await query.order('score_valor', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar scores: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Calcula o score de um cliente
   */
  async calculateScore(clienteId: string): Promise<ScoreCalculationResult> {
    // Se Supabase não estiver disponível, usar dados de demonstração
    if (!supabase || supabaseError) {
      const { generateDemoScoreCalculation } = await import('./demoData');
      return generateDemoScoreCalculation(clienteId);
    }

    try {
      const { data, error } = await supabase.rpc('calcular_score_credito', {
        p_cliente_id: clienteId,
        p_lojista_id: (await supabase.auth.getUser()).data.user?.id,
        p_tipo_score: 'RECALCULADO'
      });

      if (error) {
        throw new Error(`Erro ao calcular score: ${error.message}`);
      }

      // Buscar detalhes adicionais do cálculo
      const score = await this.getClienteScore(clienteId);
      
      return {
        score: data,
        classification: this.getClassificationFromScore(data),
        factors: {
          positive: score?.fatores_positivos || [],
          negative: score?.fatores_negativos || []
        },
        breakdown: {
          historico_pagamentos: score?.historico_pagamentos_score || 0,
          utilizacao_limite: score?.utilizacao_limite_score || 0,
          tempo_relacionamento: score?.tempo_relacionamento_score || 0,
          diversidade_transacoes: score?.diversidade_transacoes_score || 0,
          comportamento_recente: score?.comportamento_recente_score || 0
        }
      };
    } catch (error) {
      console.warn('Função de score não encontrada, usando dados de demonstração:', error);
      const { generateDemoScoreCalculation } = await import('./demoData');
      return generateDemoScoreCalculation(clienteId);
    }
  }

  /**
   * Atualiza o score de um cliente
   */
  async updateClienteScore(
    clienteId: string, 
    tipoScore: ScoreType = 'RECALCULADO',
    observacoes?: string
  ): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase.rpc('atualizar_score_cliente', {
      p_cliente_id: clienteId,
      p_lojista_id: user.user?.id,
      p_tipo_score: tipoScore,
      p_observacoes: observacoes
    });

    if (error) {
      throw new Error(`Erro ao atualizar score: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtém histórico de scores de um cliente
   */
  async getScoreHistory(clienteId: string): Promise<ScoreHistory[]> {
    const { data, error } = await supabase
      .from('historico_scores_credito')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_alteracao', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obtém configurações de score do lojista
   */
  async getScoreConfig(): Promise<ScoreConfig | null> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('configuracoes_score')
      .select('*')
      .eq('lojista_id', user.user?.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar configurações: ${error.message}`);
    }

    return data;
  }

  /**
   * Atualiza configurações de score
   */
  async updateScoreConfig(config: Partial<ScoreConfig>): Promise<ScoreConfig> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('configuracoes_score')
      .upsert({
        ...config,
        lojista_id: user.user?.id,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar configurações: ${error.message}`);
    }

    return data;
  }

  /**
   * Bloqueia ou desbloqueia um score
   */
  async toggleScoreBlock(
    scoreId: string, 
    bloqueado: boolean, 
    motivo?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('scores_credito')
      .update({
        bloqueado,
        motivo_bloqueio: bloqueado ? motivo : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', scoreId);

    if (error) {
      throw new Error(`Erro ao ${bloqueado ? 'bloquear' : 'desbloquear'} score: ${error.message}`);
    }
  }

  /**
   * Obtém alertas de score
   */
  async getScoreAlerts(): Promise<ScoreAlert[]> {
    const alerts: ScoreAlert[] = [];
    
    // Buscar scores baixos
    const { data: lowScores } = await supabase
      .from('scores_credito')
      .select(`
        *,
        clientes!inner(nome)
      `)
      .eq('classificacao_risco', 'MUITO_BAIXO')
      .eq('bloqueado', false);

    lowScores?.forEach(score => {
      alerts.push({
        type: 'LOW_SCORE',
        message: `Cliente ${score.clientes.nome} tem score muito baixo (${score.score_valor})`,
        severity: 'HIGH',
        cliente_id: score.cliente_id,
        score_atual: score.score_valor
      });
    });

    // Buscar scores com variação significativa
    const { data: significantChanges } = await supabase
      .from('scores_credito')
      .select(`
        *,
        clientes!inner(nome)
      `)
      .not('variacao_score', 'is', null)
      .or('variacao_score.gte.50,variacao_score.lte.-50');

    significantChanges?.forEach(score => {
      alerts.push({
        type: 'SIGNIFICANT_CHANGE',
        message: `Score do cliente ${score.clientes.nome} teve variação significativa (${score.variacao_score > 0 ? '+' : ''}${score.variacao_score} pontos)`,
        severity: Math.abs(score.variacao_score) > 100 ? 'HIGH' : 'MEDIUM',
        cliente_id: score.cliente_id,
        score_atual: score.score_valor,
        score_anterior: score.score_anterior,
        variacao: score.variacao_score
      });
    });

    // Buscar scores expirados
    const { data: expiredScores } = await supabase
      .from('scores_credito')
      .select(`
        *,
        clientes!inner(nome)
      `)
      .lt('valido_ate', new Date().toISOString())
      .eq('bloqueado', false);

    expiredScores?.forEach(score => {
      alerts.push({
        type: 'EXPIRED_SCORE',
        message: `Score do cliente ${score.clientes.nome} está expirado`,
        severity: 'MEDIUM',
        cliente_id: score.cliente_id,
        score_atual: score.score_valor
      });
    });

    return alerts.sort((a, b) => {
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Obtém estatísticas de scores
   */
  async getScoreStats(): Promise<ScoreStats> {
    const { data: scores } = await supabase
      .from('scores_credito')
      .select('score_valor, classificacao_risco, created_at')
      .gte('valido_ate', new Date().toISOString());

    if (!scores) {
      throw new Error('Erro ao buscar estatísticas');
    }

    const totalClientes = scores.length;
    const scoreMedio = scores.reduce((sum, s) => sum + s.score_valor, 0) / totalClientes || 0;

    const distribuicaoRisco: Record<RiskClassification, number> = {
      MUITO_BAIXO: 0,
      BAIXO: 0,
      MEDIO: 0,
      ALTO: 0,
      MUITO_ALTO: 0
    };

    scores.forEach(score => {
      distribuicaoRisco[score.classificacao_risco]++;
    });

    // Calcular tendência mensal (últimos 6 meses)
    const tendenciaMensal = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthScores = scores.filter(s => {
        const scoreDate = new Date(s.created_at);
        return scoreDate >= monthStart && scoreDate <= monthEnd;
      });

      tendenciaMensal.push({
        mes: monthStart.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        score_medio: monthScores.reduce((sum, s) => sum + s.score_valor, 0) / monthScores.length || 0,
        total_clientes: monthScores.length
      });
    }

    const alerts = await this.getScoreAlerts();

    return {
      total_clientes: totalClientes,
      score_medio: Math.round(scoreMedio),
      distribuicao_risco: distribuicaoRisco,
      tendencia_mensal: tendenciaMensal,
      alertas_ativos: alerts.length
    };
  }

  /**
   * Recalcula scores de todos os clientes (operação em lote)
   */
  async recalculateAllScores(): Promise<{ success: number; errors: number }> {
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id');

    if (!clientes) {
      throw new Error('Erro ao buscar clientes');
    }

    let success = 0;
    let errors = 0;

    for (const cliente of clientes) {
      try {
        await this.updateClienteScore(cliente.id, 'RECALCULADO', 'Recálculo em lote');
        success++;
      } catch (error) {
        console.error(`Erro ao recalcular score do cliente ${cliente.id}:`, error);
        errors++;
      }
    }

    return { success, errors };
  }

  /**
   * Utilitário para obter classificação baseada no score
   */
  private getClassificationFromScore(score: number): RiskClassification {
    if (score <= 200) return 'MUITO_BAIXO';
    if (score <= 400) return 'BAIXO';
    if (score <= 600) return 'MEDIO';
    if (score <= 800) return 'ALTO';
    return 'MUITO_ALTO';
  }

  /**
   * Utilitário para obter cor da classificação
   */
  public getClassificationColor(classification: RiskClassification): string {
    const colors = {
      MUITO_BAIXO: 'text-red-600 bg-red-100',
      BAIXO: 'text-orange-600 bg-orange-100',
      MEDIO: 'text-yellow-600 bg-yellow-100',
      ALTO: 'text-blue-600 bg-blue-100',
      MUITO_ALTO: 'text-green-600 bg-green-100'
    };
    return colors[classification];
  }

  /**
   * Utilitário para obter texto da classificação
   */
  public getClassificationText(classification: RiskClassification): string {
    const texts = {
      MUITO_BAIXO: 'Muito Baixo',
      BAIXO: 'Baixo',
      MEDIO: 'Médio',
      ALTO: 'Alto',
      MUITO_ALTO: 'Muito Alto'
    };
    return texts[classification];
  }
}

// Instância singleton
export const creditScoreService = CreditScoreService.getInstance();