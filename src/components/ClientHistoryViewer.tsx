// =====================================================
// Componente de Visualização do Histórico de Clientes
// =====================================================

import React, { useState, useMemo } from 'react';
import { 
  ClockIcon, 
  UserIcon, 
  EyeIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { useClientHistory, useVersionComparison, useHistoryExport } from '../hooks/useClientHistory';
import type { 
  HistoricoCliente, 
  FiltrosHistorico,
  ConfiguracaoVisualizacao 
} from '../lib/clientHistory/types';
import { 
  TIPOS_OPERACAO, 
  CAMPOS_CLIENTE, 
  CORES_OPERACAO,
  CAMPOS_SENSIVEIS 
} from '../lib/clientHistory/types';

interface ClientHistoryViewerProps {
  clienteId: string;
  clienteNome: string;
  mostrarFiltros?: boolean;
  altura?: string;
  onVersaoSelecionada?: (versao: number) => void;
}

export default function ClientHistoryViewer({
  clienteId,
  clienteNome,
  mostrarFiltros = true,
  altura = 'h-96',
  onVersaoSelecionada
}: ClientHistoryViewerProps) {
  const [filtros, setFiltros] = useState<FiltrosHistorico>({});
  const [mostrarDetalhes, setMostrarDetalhes] = useState<string | null>(null);
  const [versoesParaComparar, setVersoesParaComparar] = useState<number[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoVisualizacao>({
    mostrar_dados_sensiveis: false,
    campos_mascarados: CAMPOS_SENSIVEIS,
    formato_data: 'relativo',
    agrupar_por: 'data',
    itens_por_pagina: 20
  });

  const {
    historico,
    loading,
    error,
    totalRegistros,
    paginaAtual,
    totalPaginas,
    carregarHistorico,
    irParaPagina
  } = useClientHistory(clienteId);

  const { comparacao, loading: loadingComparacao, compararVersoes } = useVersionComparison();
  const { loading: loadingExport, exportarHistorico } = useHistoryExport();

  // Aplicar filtros locais
  const historicoFiltrado = useMemo(() => {
    let resultado = historico;

    if (filtros.tipo_operacao) {
      resultado = resultado.filter(h => h.tipo_operacao === filtros.tipo_operacao);
    }

    if (filtros.usuario_id) {
      resultado = resultado.filter(h => h.usuario_id === filtros.usuario_id);
    }

    if (filtros.campos_alterados && filtros.campos_alterados.length > 0) {
      resultado = resultado.filter(h => 
        h.campos_alterados.some(campo => filtros.campos_alterados!.includes(campo))
      );
    }

    return resultado;
  }, [historico, filtros]);

  const handleFiltroChange = (novosFiltros: Partial<FiltrosHistorico>) => {
    const filtrosAtualizados = { ...filtros, ...novosFiltros };
    setFiltros(filtrosAtualizados);
    carregarHistorico(filtrosAtualizados);
  };

  const handleComparar = async () => {
    if (versoesParaComparar.length === 2) {
      await compararVersoes(
        clienteId,
        Math.min(...versoesParaComparar),
        Math.max(...versoesParaComparar)
      );
    }
  };

  const handleExportar = async (formato: 'json' | 'csv') => {
    await exportarHistorico(clienteId, formato);
  };

  const formatarData = (data: string) => {
    const dataObj = new Date(data);
    
    if (configuracao.formato_data === 'relativo') {
      const agora = new Date();
      const diff = agora.getTime() - dataObj.getTime();
      const minutos = Math.floor(diff / (1000 * 60));
      const horas = Math.floor(minutos / 60);
      const dias = Math.floor(horas / 24);

      if (minutos < 1) return 'Agora mesmo';
      if (minutos < 60) return `${minutos} min atrás`;
      if (horas < 24) return `${horas}h atrás`;
      if (dias < 7) return `${dias} dias atrás`;
    }

    return dataObj.toLocaleString('pt-BR');
  };

  const formatarValor = (campo: string, valor: any) => {
    if (valor === null || valor === undefined) return '-';

    // Aplicar máscara se necessário
    if (!configuracao.mostrar_dados_sensiveis && configuracao.campos_mascarados.includes(campo)) {
      switch (campo) {
        case 'cpf':
          return String(valor).replace(/(\d{3})\d{6}(\d{2})/, '$1.***.**$2');
        case 'telefone':
          return String(valor).replace(/(\d{2})\d{5}(\d{4})/, '($1) *****-$2');
        default:
          return '***';
      }
    }

    // Formatação por tipo
    switch (campo) {
      case 'limite_credito':
      case 'renda_mensal':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(Number(valor));
      case 'data_nascimento':
        return new Date(valor).toLocaleDateString('pt-BR');
      case 'status':
        return valor === 'ativo' ? 'Ativo' : 'Inativo';
      default:
        return String(valor);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Erro ao carregar histórico
            </h3>
            <div className="mt-2 text-sm text-red-700">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Cabeçalho */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Histórico de Alterações
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {clienteNome} • {totalRegistros} registros
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Botão de Comparar */}
            {versoesParaComparar.length === 2 && (
              <button
                onClick={handleComparar}
                disabled={loadingComparacao}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowsRightLeftIcon className="h-4 w-4 mr-2" />
                Comparar Versões
              </button>
            )}

            {/* Botões de Exportação */}
            <div className="relative inline-block text-left">
              <button
                disabled={loadingExport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                Exportar
              </button>
              {/* Menu dropdown seria implementado aqui */}
            </div>
          </div>
        </div>

        {/* Filtros */}
        {mostrarFiltros && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro por Operação */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tipo de Operação
              </label>
              <select
                value={filtros.tipo_operacao || ''}
                onChange={(e) => handleFiltroChange({ 
                  tipo_operacao: e.target.value as any || undefined 
                })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">Todas</option>
                <option value="INSERT">Criação</option>
                <option value="UPDATE">Atualização</option>
                <option value="DELETE">Exclusão</option>
              </select>
            </div>

            {/* Filtro por Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Data Início
              </label>
              <input
                type="date"
                value={filtros.data_inicio || ''}
                onChange={(e) => handleFiltroChange({ data_inicio: e.target.value || undefined })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Data Fim
              </label>
              <input
                type="date"
                value={filtros.data_fim || ''}
                onChange={(e) => handleFiltroChange({ data_fim: e.target.value || undefined })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Lista do Histórico */}
      <div className={`${altura} overflow-y-auto`}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : historicoFiltrado.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Nenhum histórico encontrado
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Não há registros de alterações para este cliente.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {historicoFiltrado.map((item) => (
              <div key={item.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {/* Checkbox para comparação */}
                    <input
                      type="checkbox"
                      checked={versoesParaComparar.includes(item.versao)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (versoesParaComparar.length < 2) {
                            setVersoesParaComparar([...versoesParaComparar, item.versao]);
                          }
                        } else {
                          setVersoesParaComparar(
                            versoesParaComparar.filter(v => v !== item.versao)
                          );
                        }
                      }}
                      disabled={!versoesParaComparar.includes(item.versao) && versoesParaComparar.length >= 2}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />

                    <div className="flex-1">
                      {/* Cabeçalho da alteração */}
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CORES_OPERACAO[item.tipo_operacao]}`}>
                          {TIPOS_OPERACAO[item.tipo_operacao]}
                        </span>
                        <span className="text-sm text-gray-500">
                          Versão {item.versao}
                        </span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-500">
                          {formatarData(item.data_alteracao)}
                        </span>
                        {item.usuario_nome && (
                          <>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-500 flex items-center">
                              <UserIcon className="h-4 w-4 mr-1" />
                              {item.usuario_nome}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Campos alterados */}
                      <div className="mt-2">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Campos alterados:</span>{' '}
                          {item.campos_alterados.includes('*') 
                            ? 'Todos os campos'
                            : item.campos_alterados.map(campo => 
                                CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo
                              ).join(', ')
                          }
                        </div>
                      </div>

                      {/* Motivo da alteração */}
                      {item.motivo_alteracao && (
                        <div className="mt-2">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Motivo:</span> {item.motivo_alteracao}
                          </div>
                        </div>
                      )}

                      {/* Detalhes expandidos */}
                      {mostrarDetalhes === item.id && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Detalhes da Alteração
                          </h4>
                          
                          {item.tipo_operacao === 'UPDATE' && item.dados_anteriores && item.dados_novos && (
                            <div className="space-y-3">
                              {item.campos_alterados.filter(campo => campo !== '*').map(campo => (
                                <div key={campo} className="grid grid-cols-3 gap-4 text-sm">
                                  <div className="font-medium text-gray-700">
                                    {CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo}
                                  </div>
                                  <div className="text-red-600">
                                    <span className="font-medium">Anterior:</span>{' '}
                                    {formatarValor(campo, item.dados_anteriores[campo])}
                                  </div>
                                  <div className="text-green-600">
                                    <span className="font-medium">Novo:</span>{' '}
                                    {formatarValor(campo, item.dados_novos[campo])}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.tipo_operacao === 'INSERT' && item.dados_novos && (
                            <div className="space-y-2">
                              {Object.entries(item.dados_novos).map(([campo, valor]) => (
                                <div key={campo} className="flex justify-between text-sm">
                                  <span className="font-medium text-gray-700">
                                    {CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo}:
                                  </span>
                                  <span className="text-green-600">
                                    {formatarValor(campo, valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.tipo_operacao === 'DELETE' && item.dados_anteriores && (
                            <div className="space-y-2">
                              {Object.entries(item.dados_anteriores).map(([campo, valor]) => (
                                <div key={campo} className="flex justify-between text-sm">
                                  <span className="font-medium text-gray-700">
                                    {CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo}:
                                  </span>
                                  <span className="text-red-600">
                                    {formatarValor(campo, valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botão de expandir/recolher */}
                  <button
                    onClick={() => setMostrarDetalhes(
                      mostrarDetalhes === item.id ? null : item.id
                    )}
                    className="ml-4 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {mostrarDetalhes === item.id ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((paginaAtual - 1) * configuracao.itens_por_pagina) + 1} a{' '}
              {Math.min(paginaAtual * configuracao.itens_por_pagina, totalRegistros)} de{' '}
              {totalRegistros} registros
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => irParaPagina(paginaAtual - 1)}
                disabled={paginaAtual <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              
              <span className="text-sm text-gray-700">
                Página {paginaAtual} de {totalPaginas}
              </span>
              
              <button
                onClick={() => irParaPagina(paginaAtual + 1)}
                disabled={paginaAtual >= totalPaginas}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comparação */}
      {comparacao.length > 0 && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Comparação de Versões
              </h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {comparacao.map((item, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4">
                    <div className="font-medium text-gray-900 mb-2">
                      {CAMPOS_CLIENTE[item.campo as keyof typeof CAMPOS_CLIENTE] || item.campo}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-red-600">Anterior:</span>
                        <div className="mt-1 p-2 bg-red-50 rounded">
                          {formatarValor(item.campo, item.valor_anterior)}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-green-600">Novo:</span>
                        <div className="mt-1 p-2 bg-green-50 rounded">
                          {formatarValor(item.campo, item.valor_novo)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setVersoesParaComparar([])}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}