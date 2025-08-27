// =====================================================
// Testes para Hooks de Histórico de Clientes
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useClientHistory, 
  useVersionComparison, 
  useHistoryStatistics,
  useAuditConfiguration 
} from '../useClientHistory';
import { clientHistoryService } from '../../lib/clientHistory/clientHistoryService';
import type { HistoricoCliente, EstatisticasHistorico, ConfiguracaoAuditoriaClientes } from '../../lib/clientHistory/types';

// Mock do serviço
vi.mock('../../lib/clientHistory/clientHistoryService', () => ({
  clientHistoryService: {
    obterHistoricoCliente: vi.fn(),
    compararVersoesCliente: vi.fn(),
    obterEstatisticasHistorico: vi.fn(),
    obterConfiguracaoAuditoria: vi.fn(),
    salvarConfiguracaoAuditoria: vi.fn()
  }
}));

describe('useClientHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve carregar histórico do cliente com sucesso', async () => {
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

    (clientHistoryService.obterHistoricoCliente as Mock).mockResolvedValue({
      historico: mockHistorico,
      total: 1
    });

    const { result } = renderHook(() => useClientHistory('cliente-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.historico).toEqual(mockHistorico);
    expect(result.current.totalRegistros).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('deve tratar erro ao carregar histórico', async () => {
    (clientHistoryService.obterHistoricoCliente as Mock).mockRejectedValue(
      new Error('Erro ao carregar')
    );

    const { result } = renderHook(() => useClientHistory('cliente-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Erro ao carregar');
    expect(result.current.historico).toEqual([]);
  });

  it('deve aplicar filtros corretamente', async () => {
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

    (clientHistoryService.obterHistoricoCliente as Mock).mockResolvedValue({
      historico: mockHistorico,
      total: 1
    });

    const { result } = renderHook(() => useClientHistory('cliente-1'));

    await act(async () => {
      await result.current.carregarHistorico({
        tipo_operacao: 'INSERT'
      });
    });

    expect(clientHistoryService.obterHistoricoCliente).toHaveBeenCalledWith(
      'cliente-1',
      expect.objectContaining({
        tipo_operacao: 'INSERT'
      })
    );
  });

  it('deve navegar entre páginas', async () => {
    (clientHistoryService.obterHistoricoCliente as Mock).mockResolvedValue({
      historico: [],
      total: 100
    });

    const { result } = renderHook(() => useClientHistory('cliente-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalPaginas).toBe(5); // 100 / 20 = 5

    await act(async () => {
      await result.current.irParaPagina(2);
    });

    expect(result.current.paginaAtual).toBe(2);
  });

  it('deve recarregar histórico', async () => {
    (clientHistoryService.obterHistoricoCliente as Mock).mockResolvedValue({
      historico: [],
      total: 0
    });

    const { result } = renderHook(() => useClientHistory('cliente-1'));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(clientHistoryService.obterHistoricoCliente).toHaveBeenCalledTimes(2); // Uma vez no mount, outra no reload
  });
});

describe('useVersionComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve comparar versões com sucesso', async () => {
    const mockComparacao = [
      {
        campo: 'nome',
        valor_anterior: 'João',
        valor_novo: 'João Silva',
        tipo_alteracao: 'ALTERADO' as const
      }
    ];

    (clientHistoryService.compararVersoesCliente as Mock).mockResolvedValue(mockComparacao);

    const { result } = renderHook(() => useVersionComparison());

    await act(async () => {
      await result.current.compararVersoes('cliente-1', 1, 2);
    });

    expect(result.current.comparacao).toEqual(mockComparacao);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('deve tratar erro na comparação', async () => {
    (clientHistoryService.compararVersoesCliente as Mock).mockRejectedValue(
      new Error('Erro na comparação')
    );

    const { result } = renderHook(() => useVersionComparison());

    await act(async () => {
      await result.current.compararVersoes('cliente-1', 1, 2);
    });

    expect(result.current.error).toBe('Erro na comparação');
    expect(result.current.comparacao).toEqual([]);
  });

  it('deve limpar comparação', async () => {
    const mockComparacao = [
      {
        campo: 'nome',
        valor_anterior: 'João',
        valor_novo: 'João Silva',
        tipo_alteracao: 'ALTERADO' as const
      }
    ];

    (clientHistoryService.compararVersoesCliente as Mock).mockResolvedValue(mockComparacao);

    const { result } = renderHook(() => useVersionComparison());

    await act(async () => {
      await result.current.compararVersoes('cliente-1', 1, 2);
    });

    expect(result.current.comparacao).toEqual(mockComparacao);

    act(() => {
      result.current.limparComparacao();
    });

    expect(result.current.comparacao).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

describe('useHistoryStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve carregar estatísticas com sucesso', async () => {
    const mockEstatisticas: EstatisticasHistorico = {
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
    };

    (clientHistoryService.obterEstatisticasHistorico as Mock).mockResolvedValue(mockEstatisticas);

    const { result } = renderHook(() => useHistoryStatistics('lojista-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.estatisticas).toEqual(mockEstatisticas);
    expect(result.current.error).toBeNull();
  });

  it('deve tratar erro ao carregar estatísticas', async () => {
    (clientHistoryService.obterEstatisticasHistorico as Mock).mockRejectedValue(
      new Error('Erro ao carregar estatísticas')
    );

    const { result } = renderHook(() => useHistoryStatistics('lojista-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Erro ao carregar estatísticas');
    expect(result.current.estatisticas).toBeNull();
  });

  it('deve recarregar estatísticas', async () => {
    const mockEstatisticas: EstatisticasHistorico = {
      total_alteracoes: 100,
      alteracoes_hoje: 5,
      alteracoes_semana: 25,
      alteracoes_mes: 80,
      usuarios_mais_ativos: [],
      campos_mais_alterados: []
    };

    (clientHistoryService.obterEstatisticasHistorico as Mock).mockResolvedValue(mockEstatisticas);

    const { result } = renderHook(() => useHistoryStatistics('lojista-1'));

    await act(async () => {
      await result.current.recarregar();
    });

    expect(clientHistoryService.obterEstatisticasHistorico).toHaveBeenCalledTimes(2);
  });
});

describe('useAuditConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve carregar configuração existente', async () => {
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

    (clientHistoryService.obterConfiguracaoAuditoria as Mock).mockResolvedValue(mockConfiguracao);

    const { result } = renderHook(() => useAuditConfiguration('lojista-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.configuracao).toEqual(mockConfiguracao);
    expect(result.current.error).toBeNull();
  });

  it('deve salvar nova configuração', async () => {
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

    (clientHistoryService.obterConfiguracaoAuditoria as Mock).mockResolvedValue(null);
    (clientHistoryService.salvarConfiguracaoAuditoria as Mock).mockResolvedValue(configSalva);

    const { result } = renderHook(() => useAuditConfiguration('lojista-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resultadoSalvar: ConfiguracaoAuditoriaClientes | undefined;

    await act(async () => {
      resultadoSalvar = await result.current.salvarConfiguracao(novaConfiguracao);
    });

    expect(resultadoSalvar).toEqual(configSalva);
    expect(result.current.configuracao).toEqual(configSalva);
    expect(result.current.salvando).toBe(false);
  });

  it('deve tratar erro ao salvar configuração', async () => {
    const novaConfiguracao = {
      lojista_id: 'lojista-1',
      dias_retencao: 180,
      max_versoes_por_cliente: 50,
      campos_auditados: ['nome'],
      notificar_alteracoes: false,
      emails_notificacao: []
    };

    (clientHistoryService.obterConfiguracaoAuditoria as Mock).mockResolvedValue(null);
    (clientHistoryService.salvarConfiguracaoAuditoria as Mock).mockRejectedValue(
      new Error('Erro ao salvar')
    );

    const { result } = renderHook(() => useAuditConfiguration('lojista-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      try {
        await result.current.salvarConfiguracao(novaConfiguracao);
      } catch (error) {
        // Esperado
      }
    });

    expect(result.current.error).toBe('Erro ao salvar');
    expect(result.current.salvando).toBe(false);
  });
});