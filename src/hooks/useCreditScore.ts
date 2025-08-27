import { useState, useEffect, useCallback } from 'react';
import { 
  CreditScore, 
  ScoreHistory, 
  ScoreConfig, 
  ScoreAlert,
  ScoreStats,
  ScoreFilters 
} from '../lib/creditScore/types';
import { creditScoreService } from '../lib/creditScore/creditScoreService';

/**
 * Hook para gerenciar scores de crédito de um cliente específico
 */
export const useClienteCreditScore = (clienteId: string) => {
  const [score, setScore] = useState<CreditScore | null>(null);
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScore = useCallback(async () => {
    if (!clienteId) return;
    
    try {
      setLoading(true);
      setError(null);
      const scoreData = await creditScoreService.getClienteScore(clienteId);
      setScore(scoreData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  const loadHistory = useCallback(async () => {
    if (!clienteId) return;
    
    try {
      const historyData = await creditScoreService.getScoreHistory(clienteId);
      setHistory(historyData);
    } catch (err: any) {
      console.error('Erro ao carregar histórico:', err);
    }
  }, [clienteId]);

  const updateScore = useCallback(async (observacoes?: string) => {
    if (!clienteId) return;
    
    try {
      setUpdating(true);
      setError(null);
      await creditScoreService.updateClienteScore(clienteId, 'RECALCULADO', observacoes);
      await loadScore();
      await loadHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }, [clienteId, loadScore, loadHistory]);

  const calculateScore = useCallback(async () => {
    if (!clienteId) return null;
    
    try {
      const result = await creditScoreService.calculateScore(clienteId);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [clienteId]);

  useEffect(() => {
    loadScore();
    loadHistory();
  }, [loadScore, loadHistory]);

  return {
    score,
    history,
    loading,
    updating,
    error,
    updateScore,
    calculateScore,
    refresh: loadScore
  };
};

/**
 * Hook para gerenciar múltiplos scores com filtros
 */
export const useCreditScores = (filters: ScoreFilters = {}) => {
  const [scores, setScores] = useState<CreditScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const scoresData = await creditScoreService.getScores(filters);
      setScores(scoresData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  return {
    scores,
    loading,
    error,
    refresh: loadScores
  };
};

/**
 * Hook para gerenciar configurações de score
 */
export const useScoreConfig = () => {
  const [config, setConfig] = useState<ScoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const configData = await creditScoreService.getScoreConfig();
      setConfig(configData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<ScoreConfig>) => {
    try {
      setSaving(true);
      setError(null);
      const updatedConfig = await creditScoreService.updateScoreConfig(newConfig);
      setConfig(updatedConfig);
      return updatedConfig;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    saving,
    error,
    updateConfig,
    refresh: loadConfig
  };
};

/**
 * Hook para gerenciar alertas de score
 */
export const useScoreAlerts = () => {
  const [alerts, setAlerts] = useState<ScoreAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const alertsData = await creditScoreService.getScoreAlerts();
      setAlerts(alertsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    
    // Atualizar alertas a cada 5 minutos
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [loadAlerts]);

  return {
    alerts,
    loading,
    error,
    refresh: loadAlerts
  };
};

/**
 * Hook para estatísticas de scores
 */
export const useScoreStats = () => {
  const [stats, setStats] = useState<ScoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const statsData = await creditScoreService.getScoreStats();
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh: loadStats
  };
};

/**
 * Hook para operações em lote de scores
 */
export const useScoreBatchOperations = () => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const recalculateAllScores = useCallback(async () => {
    try {
      setProcessing(true);
      setError(null);
      setProgress({ current: 0, total: 0 });
      
      const result = await creditScoreService.recalculateAllScores();
      
      setProgress({ current: result.success, total: result.success + result.errors });
      
      if (result.errors > 0) {
        setError(`${result.errors} scores falharam ao recalcular`);
      }
      
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  const blockScore = useCallback(async (scoreId: string, motivo: string) => {
    try {
      await creditScoreService.toggleScoreBlock(scoreId, true, motivo);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const unblockScore = useCallback(async (scoreId: string) => {
    try {
      await creditScoreService.toggleScoreBlock(scoreId, false);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    processing,
    progress,
    error,
    recalculateAllScores,
    blockScore,
    unblockScore
  };
};