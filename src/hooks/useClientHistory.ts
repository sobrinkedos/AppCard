// =====================================================
// Hooks para Sistema de Histórico de Clientes
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { clientHistoryService } from '../lib/clientHistory/clientHistoryService';
import type {
  HistoricoCliente,
  ConfiguracaoAuditoriaClientes,
  ComparacaoVersoes,
  EstatisticasHistorico,
  FiltrosHistorico,
  UseHistoricoClienteReturn,
  UseComparacaoVersoesReturn,
  UseEstatisticasHistoricoReturn
} from '../lib/clientHistory/types';

// =====================================================
// Hook para Histórico de Cliente
// =====================================================

export function useClientHistory(clienteId: string): UseHistoricoClienteReturn {
  const [historico, setHistorico] = useState<HistoricoCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosHistorico>({});

  const totalPaginas = Math.ceil(totalRegistros / itensPorPagina);

  const carregarHistorico = useCallback(async (filtros: FiltrosHistorico = {}) => {
    if (!clienteId) return;

    setLoading(true);
    setError(null);

    try {
      const filtrosCompletos = {
        ...filtros,
        limite: itensPorPagina,
        offset: (paginaAtual - 1) * itensPorPagina
      };

      const resultado = await clientHistoryService.obterHistoricoCliente(
        clienteId,
        filtrosCompletos
      );

      setHistorico(resultado.historico);
      setTotalRegistros(resultado.total);
      setFiltrosAtivos(filtros);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
      setHistorico([]);
      setTotalRegistros(0);
    } finally {
      setLoading(false);
    }
  }, [clienteId, paginaAtual, itensPorPagina]);

  const carregarMais = useCallback(async () => {
    if (!clienteId || loading || paginaAtual >= totalPaginas) return;

    setLoading(true);
    setError(null);

    try {
      const filtrosCompletos = {
        ...filtrosAtivos,
        limite: itensPorPagina,
        offset: paginaAtual * itensPorPagina
      };

      const resultado = await clientHistoryService.obterHistoricoCliente(
        clienteId,
        filtrosCompletos
      );

      setHistorico(prev => [...prev, ...resultado.historico]);
      setPaginaAtual(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar mais registros');
    } finally {
      setLoading(false);
    }
  }, [clienteId, loading, paginaAtual, totalPaginas, filtrosAtivos, itensPorPagina]);

  const recarregar = useCallback(async () => {
    setPaginaAtual(1);
    await carregarHistorico(filtrosAtivos);
  }, [carregarHistorico, filtrosAtivos]);

  const irParaPagina = useCallback(async (pagina: number) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    
    setPaginaAtual(pagina);
    await carregarHistorico(filtrosAtivos);
  }, [totalPaginas, carregarHistorico, filtrosAtivos]);

  // Carregar histórico inicial
  useEffect(() => {
    if (clienteId) {
      carregarHistorico();
    }
  }, [clienteId]);

  return {
    historico,
    loading,
    error,
    totalRegistros,
    paginaAtual,
    totalPaginas,
    carregarHistorico,
    carregarMais,
    recarregar,
    irParaPagina
  };
}

// =====================================================
// Hook para Comparação de Versões
// =====================================================

export function useVersionComparison(): UseComparacaoVersoesReturn {
  const [comparacao, setComparacao] = useState<ComparacaoVersoes[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compararVersoes = useCallback(async (
    clienteId: string,
    versao1: number,
    versao2: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      const resultado = await clientHistoryService.compararVersoesCliente(
        clienteId,
        versao1,
        versao2
      );

      setComparacao(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao comparar versões');
      setComparacao([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const limparComparacao = useCallback(() => {
    setComparacao([]);
    setError(null);
  }, []);

  return {
    comparacao,
    loading,
    error,
    compararVersoes,
    limparComparacao
  };
}

// =====================================================
// Hook para Estatísticas do Histórico
// =====================================================

export function useHistoryStatistics(lojistaId: string): UseEstatisticasHistoricoReturn {
  const [estatisticas, setEstatisticas] = useState<EstatisticasHistorico | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarEstatisticas = useCallback(async () => {
    if (!lojistaId) return;

    setLoading(true);
    setError(null);

    try {
      const resultado = await clientHistoryService.obterEstatisticasHistorico(lojistaId);
      setEstatisticas(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas');
      setEstatisticas(null);
    } finally {
      setLoading(false);
    }
  }, [lojistaId]);

  const recarregar = useCallback(async () => {
    await carregarEstatisticas();
  }, [carregarEstatisticas]);

  // Carregar estatísticas inicial
  useEffect(() => {
    if (lojistaId) {
      carregarEstatisticas();
    }
  }, [lojistaId, carregarEstatisticas]);

  return {
    estatisticas,
    loading,
    error,
    carregarEstatisticas,
    recarregar
  };
}

// =====================================================
// Hook para Configuração de Auditoria
// =====================================================

export function useAuditConfiguration(lojistaId: string) {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoAuditoriaClientes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarConfiguracao = useCallback(async () => {
    if (!lojistaId) return;

    setLoading(true);
    setError(null);

    try {
      const resultado = await clientHistoryService.obterConfiguracaoAuditoria(lojistaId);
      setConfiguracao(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração');
      setConfiguracao(null);
    } finally {
      setLoading(false);
    }
  }, [lojistaId]);

  const salvarConfiguracao = useCallback(async (
    novaConfiguracao: Omit<ConfiguracaoAuditoriaClientes, 'id' | 'data_criacao' | 'data_atualizacao'>
  ) => {
    setSalvando(true);
    setError(null);

    try {
      const resultado = await clientHistoryService.salvarConfiguracaoAuditoria(novaConfiguracao);
      setConfiguracao(resultado);
      return resultado;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
      throw err;
    } finally {
      setSalvando(false);
    }
  }, []);

  // Carregar configuração inicial
  useEffect(() => {
    if (lojistaId) {
      carregarConfiguracao();
    }
  }, [lojistaId, carregarConfiguracao]);

  return {
    configuracao,
    loading,
    error,
    salvando,
    carregarConfiguracao,
    salvarConfiguracao
  };
}

// =====================================================
// Hook para Busca no Histórico
// =====================================================

export function useHistorySearch(lojistaId: string) {
  const [resultados, setResultados] = useState<HistoricoCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState('');

  const buscar = useCallback(async (texto: string) => {
    if (!lojistaId || !texto.trim()) {
      setResultados([]);
      return;
    }

    setLoading(true);
    setError(null);
    setTermoBusca(texto);

    try {
      const resultado = await clientHistoryService.buscarHistoricoPorTexto(
        lojistaId,
        texto.trim()
      );
      setResultados(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na busca');
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }, [lojistaId]);

  const limparBusca = useCallback(() => {
    setResultados([]);
    setTermoBusca('');
    setError(null);
  }, []);

  return {
    resultados,
    loading,
    error,
    termoBusca,
    buscar,
    limparBusca
  };
}

// =====================================================
// Hook para Exportação de Histórico
// =====================================================

export function useHistoryExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportarHistorico = useCallback(async (
    clienteId: string,
    formato: 'json' | 'csv' = 'json'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const conteudo = await clientHistoryService.exportarHistorico(clienteId, formato);
      
      // Criar e baixar arquivo
      const blob = new Blob([conteudo], {
        type: formato === 'json' ? 'application/json' : 'text/csv'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historico-cliente-${clienteId}.${formato}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar histórico');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    exportarHistorico
  };
}