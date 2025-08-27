// =====================================================
// Testes para ClientHistoryService
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { clientHistoryService } from '../clientHistoryService';
import { supabase } from '../../supabaseClient';
import type { HistoricoCliente, ConfiguracaoAuditoriaClientes } from '../types';

// Mock do Supabase
vi.mock('../../supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn()
          })),
          not: vi.fn(),
          or: vi.fn(),
          in: vi.fn()
        })),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}));

describe('ClientHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('obterHistoricoCliente', () => {
    it('deve retornar histórico do cliente com sucesso', async () => {
      const mockHistorico: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: 'cliente-1',
          versao: 1,
          dados_anteriores: null,
          dados_novos: { nome: 'João Silva', email: 'joao@email.com' },
          campos_alterados: ['*'],
          tipo_operacao: 'INSERT',
          usuario_id: 'user-1',
          usuario_nome: 'Admin',
          data_alteracao: '2024-01-01T10:00:00Z'
        }
      ];

      (supabase.rpc as Mock).mockResolvedValue({
        data: mockHistorico,
        error: null
      });

      const resultado = await clientHistoryService.obterHistoricoCliente('cliente-1');

      expect(resultado.historico).toEqual(mockHistorico);
      expect(resultado.total).toBe(1);
      expect(supabase.rpc).toHaveBeenCalledWith('obter_historico_cliente', {
        p_cliente_id: 'cliente-1',
        p_limite: 50,
        p_offset: 0
      });
    });

    it('deve aplicar filtros corretamente', async () => {
      const mockHistorico: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: 'cliente-1',
          versao: 1,
          dados_anteriores: { nome: 'João' },
          dados_novos: { nome: 'João Silva' },
          campos_alterados: ['nome'],
          tipo_operacao: 'UPDATE',
          usuario_id: 'user-1',
          usuario_nome: 'Admin',
          data_alteracao: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          cliente_id: 'cliente-1',
          versao: 2,
          dados_anteriores: { email: 'joao@old.com' },
          dados_novos: { email: 'joao@new.com' },
          campos_alterados: ['email'],
          tipo_operacao: 'UPDATE',
          usuario_id: 'user-2',
          usuario_nome: 'User',
          data_alteracao: '2024-01-02T10:00:00Z'
        }
      ];

      (supabase.rpc as Mock).mockResolvedValue({
        data: mockHistorico,
        error: null
      });

      const resultado = await clientHistoryService.obterHistoricoCliente('cliente-1', {
        tipo_operacao: 'UPDATE',
        usuario_id: 'user-1'
      });

      expect(resultado.historico).toHaveLength(1);
      expect(resultado.historico[0].usuario_id).toBe('user-1');
    });

    it('deve tratar erro ao buscar histórico', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: null,
        error: { message: 'Erro no banco' }
      });

      await expect(
        clientHistoryService.obterHistoricoCliente('cliente-1')
      ).rejects.toThrow('Falha ao carregar histórico do cliente');
    });
  });

  describe('compararVersoesCliente', () => {
    it('deve comparar versões com sucesso', async () => {
      const mockComparacao = [
        {
          campo: 'nome',
          valor_anterior: 'João',
          valor_novo: 'João Silva',
          tipo_alteracao: 'ALTERADO'
        }
      ];

      (supabase.rpc as Mock).mockResolvedValue({
        data: mockComparacao,
        error: null
      });

      const resultado = await clientHistoryService.compararVersoesCliente(
        'cliente-1',
        1,
        2
      );

      expect(resultado).toEqual(mockComparacao);
      expect(supabase.rpc).toHaveBeenCalledWith('comparar_versoes_cliente', {
        p_cliente_id: 'cliente-1',
        p_versao_anterior: 1,
        p_versao_nova: 2
      });
    });

    it('deve tratar erro na comparação', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: null,
        error: { message: 'Erro na comparação' }
      });

      await expect(
        clientHistoryService.compararVersoesCliente('cliente-1', 1, 2)
      ).rejects.toThrow('Falha ao comparar versões do cliente');
    });
  });

  describe('obterEstatisticasHistorico', () => {
    it('deve retornar estatísticas com sucesso', async () => {
      const mockEstatisticas = [{
        total_alteracoes: 100,
        alteracoes_hoje: 5,
        alteracoes_semana: 25,
        alteracoes_mes: 80,
        usuarios_mais_ativos: [
          { usuario_id: 'user-1', usuario_nome: 'Admin', total_alteracoes: 50 }
        ],
        campos_mais_alterados: [
          { campo: 'nome', total_alteracoes: 30 }
        ]
      }];

      (supabase.rpc as Mock).mockResolvedValue({
        data: mockEstatisticas,
        error: null
      });

      const resultado = await clientHistoryService.obterEstatisticasHistorico('lojista-1');

      expect(resultado).toEqual(mockEstatisticas[0]);
      expect(supabase.rpc).toHaveBeenCalledWith('estatisticas_historico_cliente', {
        p_lojista_id: 'lojista-1'
      });
    });

    it('deve retornar estatísticas vazias quando não há dados', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: [],
        error: null
      });

      const resultado = await clientHistoryService.obterEstatisticasHistorico('lojista-1');

      expect(resultado.total_alteracoes).toBe(0);
      expect(resultado.usuarios_mais_ativos).toEqual([]);
    });
  });

  describe('obterConfiguracaoAuditoria', () => {
    it('deve retornar configuração existente', async () => {
      const mockConfiguracao: ConfiguracaoAuditoriaClientes = {
        id: 'config-1',
        lojista_id: 'lojista-1',
        dias_retencao: 365,
        max_versoes_por_cliente: 100,
        campos_auditados: ['nome', 'email'],
        notificar_alteracoes: true,
        emails_notificacao: ['admin@loja.com'],
        data_criacao: '2024-01-01T00:00:00Z',
        data_atualizacao: '2024-01-01T00:00:00Z'
      };

      const mockFrom = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockConfiguracao,
              error: null
            })
          }))
        }))
      };

      (supabase.from as Mock).mockReturnValue(mockFrom);

      const resultado = await clientHistoryService.obterConfiguracaoAuditoria('lojista-1');

      expect(resultado).toEqual(mockConfiguracao);
    });

    it('deve retornar null quando não há configuração', async () => {
      const mockFrom = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Registro não encontrado
            })
          }))
        }))
      };

      (supabase.from as Mock).mockReturnValue(mockFrom);

      const resultado = await clientHistoryService.obterConfiguracaoAuditoria('lojista-1');

      expect(resultado).toBeNull();
    });
  });

  describe('salvarConfiguracaoAuditoria', () => {
    it('deve salvar configuração com sucesso', async () => {
      const novaConfiguracao = {
        lojista_id: 'lojista-1',
        dias_retencao: 180,
        max_versoes_por_cliente: 50,
        campos_auditados: ['nome', 'email', 'telefone'],
        notificar_alteracoes: false,
        emails_notificacao: []
      };

      const configSalva: ConfiguracaoAuditoriaClientes = {
        id: 'config-1',
        ...novaConfiguracao,
        data_criacao: '2024-01-01T00:00:00Z',
        data_atualizacao: '2024-01-01T10:00:00Z'
      };

      const mockFrom = {
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: configSalva,
              error: null
            })
          }))
        }))
      };

      (supabase.from as Mock).mockReturnValue(mockFrom);

      const resultado = await clientHistoryService.salvarConfiguracaoAuditoria(novaConfiguracao);

      expect(resultado).toEqual(configSalva);
    });
  });

  describe('formatarHistoricoDetalhado', () => {
    it('deve formatar histórico corretamente', () => {
      const historico: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: 'cliente-1',
          versao: 1,
          dados_anteriores: { nome: 'João' },
          dados_novos: { nome: 'João Silva' },
          campos_alterados: ['nome'],
          tipo_operacao: 'UPDATE',
          usuario_id: 'user-1',
          data_alteracao: '2024-01-01T10:00:00Z'
        }
      ];

      const resultado = clientHistoryService.formatarHistoricoDetalhado(historico);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].alteracoes_formatadas).toHaveLength(1);
      expect(resultado[0].alteracoes_formatadas[0]).toEqual({
        campo: 'nome',
        label: 'Nome',
        valor_anterior: 'João',
        valor_novo: 'João Silva',
        tipo_alteracao: 'ALTERADO'
      });
    });
  });

  describe('exportarHistorico', () => {
    it('deve exportar histórico em formato JSON', async () => {
      const mockHistorico: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: 'cliente-1',
          versao: 1,
          dados_anteriores: null,
          dados_novos: { nome: 'João Silva' },
          campos_alterados: ['*'],
          tipo_operacao: 'INSERT',
          usuario_id: 'user-1',
          data_alteracao: '2024-01-01T10:00:00Z'
        }
      ];

      (supabase.rpc as Mock).mockResolvedValue({
        data: mockHistorico,
        error: null
      });

      const resultado = await clientHistoryService.exportarHistorico('cliente-1', 'json');

      expect(resultado).toBe(JSON.stringify(mockHistorico, null, 2));
    });

    it('deve exportar histórico em formato CSV', async () => {
      const mockHistorico: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: 'cliente-1',
          versao: 1,
          dados_anteriores: null,
          dados_novos: { nome: 'João Silva' },
          campos_alterados: ['*'],
          tipo_operacao: 'INSERT',
          usuario_id: 'user-1',
          usuario_nome: 'Admin',
          data_alteracao: '2024-01-01T10:00:00Z'
        }
      ];

      (supabase.rpc as Mock).mockResolvedValue({
        data: mockHistorico,
        error: null
      });

      const resultado = await clientHistoryService.exportarHistorico('cliente-1', 'csv');

      expect(resultado).toContain('"Data/Hora","Versão","Operação","Usuário","Campos Alterados","Motivo"');
      expect(resultado).toContain('INSERT');
      expect(resultado).toContain('Admin');
    });
  });

  describe('limparHistoricoAntigo', () => {
    it('deve limpar histórico antigo com sucesso', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: 25,
        error: null
      });

      const resultado = await clientHistoryService.limparHistoricoAntigo();

      expect(resultado).toBe(25);
      expect(supabase.rpc).toHaveBeenCalledWith('limpar_historico_antigo');
    });

    it('deve tratar erro na limpeza', async () => {
      (supabase.rpc as Mock).mockResolvedValue({
        data: null,
        error: { message: 'Erro na limpeza' }
      });

      await expect(
        clientHistoryService.limparHistoricoAntigo()
      ).rejects.toThrow('Falha ao limpar histórico antigo');
    });
  });
});