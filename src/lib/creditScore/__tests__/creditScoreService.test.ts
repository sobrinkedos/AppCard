import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreditScoreService } from '../creditScoreService';
import { supabase } from '../../supabaseClient';

// Mock do Supabase
vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}));

describe('CreditScoreService', () => {
  let creditScoreService: CreditScoreService;
  const mockClienteId = 'cliente-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    creditScoreService = CreditScoreService.getInstance();
    vi.clearAllMocks();
    
    // Mock do usuário autenticado
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: mockUserId } }
    });
  });

  describe('getClienteScore', () => {
    it('deve retornar o score de um cliente', async () => {
      const mockScore = {
        id: 'score-123',
        cliente_id: mockClienteId,
        score_valor: 750,
        classificacao_risco: 'ALTO',
        created_at: '2024-01-01T00:00:00Z'
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockScore, error: null })
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await creditScoreService.getClienteScore(mockClienteId);

      expect(result).toEqual(mockScore);
      expect(supabase.from).toHaveBeenCalledWith('scores_credito');
      expect(mockQuery.eq).toHaveBeenCalledWith('cliente_id', mockClienteId);
    });

    it('deve retornar null quando não encontrar score', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' } 
        })
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await creditScoreService.getClienteScore(mockClienteId);

      expect(result).toBeNull();
    });

    it('deve lançar erro quando houver erro no banco', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' } 
        })
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      await expect(creditScoreService.getClienteScore(mockClienteId))
        .rejects.toThrow('Erro ao buscar score: Database error');
    });
  });

  describe('calculateScore', () => {
    it('deve calcular o score de um cliente', async () => {
      const mockScoreValue = 750;
      
      (supabase.rpc as any).mockResolvedValue({
        data: mockScoreValue,
        error: null
      });

      // Mock para getClienteScore
      const mockScore = {
        fatores_positivos: ['Bom histórico'],
        fatores_negativos: ['Alta utilização'],
        historico_pagamentos_score: 800,
        utilizacao_limite_score: 600,
        tempo_relacionamento_score: 700,
        diversidade_transacoes_score: 750,
        comportamento_recente_score: 800
      };

      vi.spyOn(creditScoreService, 'getClienteScore').mockResolvedValue(mockScore as any);

      const result = await creditScoreService.calculateScore(mockClienteId);

      expect(result.score).toBe(mockScoreValue);
      expect(result.classification).toBe('ALTO');
      expect(result.factors.positive).toEqual(['Bom histórico']);
      expect(result.factors.negative).toEqual(['Alta utilização']);
      expect(supabase.rpc).toHaveBeenCalledWith('calcular_score_credito', {
        p_cliente_id: mockClienteId,
        p_lojista_id: mockUserId,
        p_tipo_score: 'RECALCULADO'
      });
    });

    it('deve lançar erro quando falhar no cálculo', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Calculation error' }
      });

      await expect(creditScoreService.calculateScore(mockClienteId))
        .rejects.toThrow('Erro ao calcular score: Calculation error');
    });
  });

  describe('updateClienteScore', () => {
    it('deve atualizar o score de um cliente', async () => {
      const mockScoreId = 'score-123';
      
      (supabase.rpc as any).mockResolvedValue({
        data: mockScoreId,
        error: null
      });

      const result = await creditScoreService.updateClienteScore(
        mockClienteId, 
        'MANUAL', 
        'Ajuste manual'
      );

      expect(result).toBe(mockScoreId);
      expect(supabase.rpc).toHaveBeenCalledWith('atualizar_score_cliente', {
        p_cliente_id: mockClienteId,
        p_lojista_id: mockUserId,
        p_tipo_score: 'MANUAL',
        p_observacoes: 'Ajuste manual'
      });
    });
  });

  describe('getScoreHistory', () => {
    it('deve retornar o histórico de scores', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          cliente_id: mockClienteId,
          score_valor: 700,
          data_alteracao: '2024-01-01T00:00:00Z'
        },
        {
          id: 'history-2',
          cliente_id: mockClienteId,
          score_valor: 750,
          data_alteracao: '2024-01-02T00:00:00Z'
        }
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockHistory, error: null })
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const result = await creditScoreService.getScoreHistory(mockClienteId);

      expect(result).toEqual(mockHistory);
      expect(supabase.from).toHaveBeenCalledWith('historico_scores_credito');
      expect(mockQuery.eq).toHaveBeenCalledWith('cliente_id', mockClienteId);
    });
  });

  describe('toggleScoreBlock', () => {
    it('deve bloquear um score', async () => {
      const mockScoreId = 'score-123';
      const motivo = 'Score suspeito';

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      await creditScoreService.toggleScoreBlock(mockScoreId, true, motivo);

      expect(supabase.from).toHaveBeenCalledWith('scores_credito');
      expect(mockQuery.update).toHaveBeenCalledWith({
        bloqueado: true,
        motivo_bloqueio: motivo,
        updated_at: expect.any(String)
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockScoreId);
    });

    it('deve desbloquear um score', async () => {
      const mockScoreId = 'score-123';

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      await creditScoreService.toggleScoreBlock(mockScoreId, false);

      expect(mockQuery.update).toHaveBeenCalledWith({
        bloqueado: false,
        motivo_bloqueio: null,
        updated_at: expect.any(String)
      });
    });
  });

  describe('getClassificationColor', () => {
    it('deve retornar a cor correta para cada classificação', () => {
      expect(creditScoreService.getClassificationColor('MUITO_BAIXO'))
        .toBe('text-red-600 bg-red-100');
      expect(creditScoreService.getClassificationColor('BAIXO'))
        .toBe('text-orange-600 bg-orange-100');
      expect(creditScoreService.getClassificationColor('MEDIO'))
        .toBe('text-yellow-600 bg-yellow-100');
      expect(creditScoreService.getClassificationColor('ALTO'))
        .toBe('text-blue-600 bg-blue-100');
      expect(creditScoreService.getClassificationColor('MUITO_ALTO'))
        .toBe('text-green-600 bg-green-100');
    });
  });

  describe('getClassificationText', () => {
    it('deve retornar o texto correto para cada classificação', () => {
      expect(creditScoreService.getClassificationText('MUITO_BAIXO'))
        .toBe('Muito Baixo');
      expect(creditScoreService.getClassificationText('BAIXO'))
        .toBe('Baixo');
      expect(creditScoreService.getClassificationText('MEDIO'))
        .toBe('Médio');
      expect(creditScoreService.getClassificationText('ALTO'))
        .toBe('Alto');
      expect(creditScoreService.getClassificationText('MUITO_ALTO'))
        .toBe('Muito Alto');
    });
  });

  describe('Singleton Pattern', () => {
    it('deve retornar a mesma instância', () => {
      const instance1 = CreditScoreService.getInstance();
      const instance2 = CreditScoreService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});