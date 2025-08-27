import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useClienteCreditScore, useScoreAlerts } from '../useCreditScore';
import { creditScoreService } from '../../lib/creditScore/creditScoreService';

// Mock do serviço
vi.mock('../../lib/creditScore/creditScoreService', () => ({
  creditScoreService: {
    getClienteScore: vi.fn(),
    getScoreHistory: vi.fn(),
    updateClienteScore: vi.fn(),
    calculateScore: vi.fn(),
    getScoreAlerts: vi.fn()
  }
}));

describe('useCreditScore hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useClienteCreditScore', () => {
    const mockClienteId = 'cliente-123';
    const mockScore = {
      id: 'score-123',
      cliente_id: mockClienteId,
      score_valor: 750,
      classificacao_risco: 'ALTO',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('deve carregar o score do cliente', async () => {
      (creditScoreService.getClienteScore as any).mockResolvedValue(mockScore);
      (creditScoreService.getScoreHistory as any).mockResolvedValue([]);

      const { result } = renderHook(() => useClienteCreditScore(mockClienteId));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.score).toEqual(mockScore);
      expect(result.current.error).toBeNull();
      expect(creditScoreService.getClienteScore).toHaveBeenCalledWith(mockClienteId);
    });

    it('deve lidar com erro ao carregar score', async () => {
      const errorMessage = 'Erro ao buscar score';
      (creditScoreService.getClienteScore as any).mockRejectedValue(new Error(errorMessage));
      (creditScoreService.getScoreHistory as any).mockResolvedValue([]);

      const { result } = renderHook(() => useClienteCreditScore(mockClienteId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.score).toBeNull();
      expect(result.current.error).toBe(errorMessage);
    });

    it('deve atualizar o score', async () => {
      (creditScoreService.getClienteScore as any).mockResolvedValue(mockScore);
      (creditScoreService.getScoreHistory as any).mockResolvedValue([]);
      (creditScoreService.updateClienteScore as any).mockResolvedValue('score-123');

      const { result } = renderHook(() => useClienteCreditScore(mockClienteId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.updating).toBe(false);

      // Chamar updateScore
      await act(async () => {
        await result.current.updateScore('Teste de atualização');
      });

      expect(creditScoreService.updateClienteScore).toHaveBeenCalledWith(
        mockClienteId,
        'RECALCULADO',
        'Teste de atualização'
      );
    });

    it('deve calcular o score', async () => {
      const mockCalculationResult = {
        score: 750,
        classification: 'ALTO' as const,
        factors: { positive: [], negative: [] },
        breakdown: {
          historico_pagamentos: 800,
          utilizacao_limite: 600,
          tempo_relacionamento: 700,
          diversidade_transacoes: 750,
          comportamento_recente: 800
        }
      };

      (creditScoreService.getClienteScore as any).mockResolvedValue(mockScore);
      (creditScoreService.getScoreHistory as any).mockResolvedValue([]);
      (creditScoreService.calculateScore as any).mockResolvedValue(mockCalculationResult);

      const { result } = renderHook(() => useClienteCreditScore(mockClienteId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const calculationResult = await result.current.calculateScore();

      expect(calculationResult).toEqual(mockCalculationResult);
      expect(creditScoreService.calculateScore).toHaveBeenCalledWith(mockClienteId);
    });

    it('não deve fazer nada se clienteId for vazio', async () => {
      const { result } = renderHook(() => useClienteCreditScore(''));

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      expect(creditScoreService.getClienteScore).not.toHaveBeenCalled();
    });
  });

  describe('useScoreAlerts', () => {
    const mockAlerts = [
      {
        type: 'LOW_SCORE' as const,
        message: 'Cliente com score baixo',
        severity: 'HIGH' as const,
        cliente_id: 'cliente-123',
        score_atual: 200
      },
      {
        type: 'SIGNIFICANT_CHANGE' as const,
        message: 'Variação significativa no score',
        severity: 'MEDIUM' as const,
        cliente_id: 'cliente-456',
        score_atual: 600,
        variacao: -100
      }
    ];

    it('deve carregar os alertas', async () => {
      (creditScoreService.getScoreAlerts as any).mockResolvedValue(mockAlerts);

      const { result } = renderHook(() => useScoreAlerts());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.alerts).toEqual(mockAlerts);
      expect(result.current.error).toBeNull();
      expect(creditScoreService.getScoreAlerts).toHaveBeenCalled();
    });

    it('deve lidar com erro ao carregar alertas', async () => {
      const errorMessage = 'Erro ao buscar alertas';
      (creditScoreService.getScoreAlerts as any).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useScoreAlerts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.alerts).toEqual([]);
      expect(result.current.error).toBe(errorMessage);
    });

    it('deve configurar interval para atualizar alertas', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      (creditScoreService.getScoreAlerts as any).mockResolvedValue(mockAlerts);

      const { unmount } = renderHook(() => useScoreAlerts());

      await waitFor(() => {
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });
});