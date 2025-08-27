// =====================================================
// Serviço de Histórico de Clientes
// =====================================================

import { supabase, supabaseError } from '../supabaseClient';
import type {
  HistoricoCliente,
  ConfiguracaoAuditoriaClientes,
  ComparacaoVersoes,
  EstatisticasHistorico,
  FiltrosHistorico,
  HistoricoClienteDetalhado
} from './types';
import { CAMPOS_CLIENTE, CAMPOS_SENSIVEIS } from './types';

class ClientHistoryService {
  private static instance: ClientHistoryService;

  static getInstance(): ClientHistoryService {
    if (!ClientHistoryService.instance) {
      ClientHistoryService.instance = new ClientHistoryService();
    }
    return ClientHistoryService.instance;
  }

  // =====================================================
  // Métodos para Histórico de Clientes
  // =====================================================

  async obterHistoricoCliente(
    clienteId: string,
    filtros: FiltrosHistorico = {}
  ): Promise<{ historico: HistoricoCliente[]; total: number }> {
    // Se Supabase não estiver disponível, retornar dados de demonstração
    if (!supabase || supabaseError) {
      const historicoDemo: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: clienteId,
          versao: 3,
          tipo_operacao: 'UPDATE',
          campos_alterados: ['limite_credito'],
          dados_anteriores: { limite_credito: 3000 },
          dados_novos: { limite_credito: 5000 },
          usuario_id: 'demo-user',
          usuario_nome: 'Administrador',
          data_alteracao: new Date(Date.now() - 86400000).toISOString(),
          motivo_alteracao: 'Aumento de limite solicitado pelo cliente'
        },
        {
          id: '2',
          cliente_id: clienteId,
          versao: 2,
          tipo_operacao: 'UPDATE',
          campos_alterados: ['telefone'],
          dados_anteriores: { telefone: '11888888888' },
          dados_novos: { telefone: '11999999999' },
          usuario_id: 'demo-user',
          usuario_nome: 'Operador',
          data_alteracao: new Date(Date.now() - 172800000).toISOString(),
          motivo_alteracao: 'Atualização de dados de contato'
        },
        {
          id: '3',
          cliente_id: clienteId,
          versao: 1,
          tipo_operacao: 'INSERT',
          campos_alterados: ['*'],
          dados_anteriores: null,
          dados_novos: {
            nome: 'Cliente Demo',
            cpf: '12345678901',
            email: 'cliente@demo.com',
            telefone: '11888888888',
            limite_credito: 3000
          },
          usuario_id: 'demo-user',
          usuario_nome: 'Sistema',
          data_alteracao: new Date(Date.now() - 259200000).toISOString(),
          motivo_alteracao: 'Cadastro inicial do cliente'
        }
      ];

      return {
        historico: historicoDemo,
        total: historicoDemo.length
      };
    }

    try {
      const { data, error } = await supabase.rpc('obter_historico_cliente', {
        p_cliente_id: clienteId,
        p_limite: filtros.limite || 50,
        p_offset: filtros.offset || 0
      });

      if (error) throw error;

      // Aplicar filtros adicionais se necessário
      let historicoFiltrado = data || [];

      if (filtros.usuario_id) {
        historicoFiltrado = historicoFiltrado.filter(
          (h: HistoricoCliente) => h.usuario_id === filtros.usuario_id
        );
      }

      if (filtros.tipo_operacao) {
        historicoFiltrado = historicoFiltrado.filter(
          (h: HistoricoCliente) => h.tipo_operacao === filtros.tipo_operacao
        );
      }

      if (filtros.data_inicio) {
        historicoFiltrado = historicoFiltrado.filter(
          (h: HistoricoCliente) => h.data_alteracao >= filtros.data_inicio!
        );
      }

      if (filtros.data_fim) {
        historicoFiltrado = historicoFiltrado.filter(
          (h: HistoricoCliente) => h.data_alteracao <= filtros.data_fim!
        );
      }

      if (filtros.campos_alterados && filtros.campos_alterados.length > 0) {
        historicoFiltrado = historicoFiltrado.filter(
          (h: HistoricoCliente) => 
            h.campos_alterados.some(campo => 
              filtros.campos_alterados!.includes(campo)
            )
        );
      }

      return {
        historico: historicoFiltrado,
        total: historicoFiltrado.length
      };
    } catch (error) {
      console.warn('Função de histórico não encontrada, usando dados de demonstração:', error);
      // Fallback para dados de demonstração
      const historicoDemo: HistoricoCliente[] = [
        {
          id: '1',
          cliente_id: clienteId,
          versao: 1,
          tipo_operacao: 'INSERT',
          campos_alterados: ['*'],
          dados_anteriores: null,
          dados_novos: { nome: 'Cliente Demo' },
          usuario_id: 'demo-user',
          usuario_nome: 'Sistema',
          data_alteracao: new Date().toISOString(),
          motivo_alteracao: 'Dados de demonstração'
        }
      ];

      return {
        historico: historicoDemo,
        total: historicoDemo.length
      };
    }
  }

  async compararVersoesCliente(
    clienteId: string,
    versaoAnterior: number,
    versaoNova: number
  ): Promise<ComparacaoVersoes[]> {
    if (!supabase || supabaseError) {
      return [
        {
          campo: 'limite_credito',
          valor_anterior: '3000',
          valor_novo: '5000',
          tipo_alteracao: 'MODIFICADO'
        }
      ];
    }

    try {
      const { data, error } = await supabase.rpc('comparar_versoes_cliente', {
        p_cliente_id: clienteId,
        p_versao_anterior: versaoAnterior,
        p_versao_nova: versaoNova
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.warn('Função de comparação não encontrada, usando dados de demonstração:', error);
      return [
        {
          campo: 'limite_credito',
          valor_anterior: '3000',
          valor_novo: '5000',
          tipo_alteracao: 'MODIFICADO'
        }
      ];
    }
  }

  async obterEstatisticasHistorico(lojistaId: string): Promise<EstatisticasHistorico> {
    if (!supabase || supabaseError) {
      return {
        total_alteracoes: 156,
        alteracoes_hoje: 8,
        alteracoes_semana: 42,
        alteracoes_mes: 156,
        usuarios_mais_ativos: [
          { usuario_id: 'demo-1', nome: 'Administrador', total: 89 },
          { usuario_id: 'demo-2', nome: 'Operador', total: 67 }
        ],
        campos_mais_alterados: [
          { campo: 'limite_credito', total: 45 },
          { campo: 'telefone', total: 32 },
          { campo: 'endereco', total: 28 }
        ]
      };
    }

    try {
      const { data, error } = await supabase.rpc('estatisticas_historico_cliente', {
        p_lojista_id: lojistaId
      });

      if (error) throw error;

      return data[0] || {
        total_alteracoes: 0,
        alteracoes_hoje: 0,
        alteracoes_semana: 0,
        alteracoes_mes: 0,
        usuarios_mais_ativos: [],
        campos_mais_alterados: []
      };
    } catch (error) {
      console.warn('Função de estatísticas não encontrada, usando dados de demonstração:', error);
      return {
        total_alteracoes: 0,
        alteracoes_hoje: 0,
        alteracoes_semana: 0,
        alteracoes_mes: 0,
        usuarios_mais_ativos: [],
        campos_mais_alterados: []
      };
    }
  }

  // =====================================================
  // Métodos para Configuração de Auditoria
  // =====================================================

  async obterConfiguracaoAuditoria(lojistaId: string): Promise<ConfiguracaoAuditoriaClientes | null> {
    if (!supabase || supabaseError) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('configuracoes_auditoria_clientes')
        .select('*')
        .eq('lojista_id', lojistaId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data;
    } catch (error) {
      console.warn('Tabela de configuração não encontrada:', error);
      return null;
    }
  }

  async salvarConfiguracaoAuditoria(
    config: Omit<ConfiguracaoAuditoriaClientes, 'id' | 'data_criacao' | 'data_atualizacao'>
  ): Promise<ConfiguracaoAuditoriaClientes> {
    if (!supabase || supabaseError) {
      throw new Error('Supabase não está disponível');
    }

    try {
      const { data, error } = await supabase
        .from('configuracoes_auditoria_clientes')
        .upsert({
          ...config,
          data_atualizacao: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Erro ao salvar configuração de auditoria:', error);
      throw new Error('Falha ao salvar configuração de auditoria');
    }
  }

  // =====================================================
  // Métodos de Formatação e Utilitários
  // =====================================================

  formatarHistoricoDetalhado(historico: HistoricoCliente[]): HistoricoClienteDetalhado[] {
    return historico.map(item => ({
      ...item,
      cliente_nome: '', // Será preenchido pelo componente
      alteracoes_formatadas: this.formatarAlteracoes(item)
    }));
  }

  private formatarAlteracoes(historico: HistoricoCliente): Array<{
    campo: string;
    label: string;
    valor_anterior: string;
    valor_novo: string;
    tipo_alteracao: string;
  }> {
    const alteracoes: Array<{
      campo: string;
      label: string;
      valor_anterior: string;
      valor_novo: string;
      tipo_alteracao: string;
    }> = [];

    if (historico.tipo_operacao === 'INSERT') {
      // Para inserção, mostrar todos os campos novos
      if (historico.dados_novos) {
        Object.entries(historico.dados_novos).forEach(([campo, valor]) => {
          alteracoes.push({
            campo,
            label: CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo,
            valor_anterior: '',
            valor_novo: this.formatarValor(campo, valor),
            tipo_alteracao: 'CRIADO'
          });
        });
      }
    } else if (historico.tipo_operacao === 'UPDATE') {
      // Para atualização, mostrar apenas campos alterados
      historico.campos_alterados.forEach(campo => {
        if (campo !== '*') {
          const valorAnterior = historico.dados_anteriores?.[campo];
          const valorNovo = historico.dados_novos?.[campo];

          alteracoes.push({
            campo,
            label: CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo,
            valor_anterior: this.formatarValor(campo, valorAnterior),
            valor_novo: this.formatarValor(campo, valorNovo),
            tipo_alteracao: 'ALTERADO'
          });
        }
      });
    } else if (historico.tipo_operacao === 'DELETE') {
      // Para exclusão, mostrar todos os campos removidos
      if (historico.dados_anteriores) {
        Object.entries(historico.dados_anteriores).forEach(([campo, valor]) => {
          alteracoes.push({
            campo,
            label: CAMPOS_CLIENTE[campo as keyof typeof CAMPOS_CLIENTE] || campo,
            valor_anterior: this.formatarValor(campo, valor),
            valor_novo: '',
            tipo_alteracao: 'REMOVIDO'
          });
        });
      }
    }

    return alteracoes;
  }

  private formatarValor(campo: string, valor: any): string {
    if (valor === null || valor === undefined) {
      return '-';
    }

    // Aplicar máscara para campos sensíveis
    if (CAMPOS_SENSIVEIS.includes(campo as any)) {
      return this.aplicarMascara(campo, valor);
    }

    // Formatação específica por tipo de campo
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

      case 'score_credito':
        return `${valor} pontos`;

      default:
        return String(valor);
    }
  }

  private aplicarMascara(campo: string, valor: any): string {
    const valorStr = String(valor);

    switch (campo) {
      case 'cpf':
        return valorStr.replace(/(\d{3})\d{6}(\d{2})/, '$1.***.**$2');

      case 'telefone':
        return valorStr.replace(/(\d{2})\d{5}(\d{4})/, '($1) *****-$2');

      case 'endereco':
        return valorStr.length > 20 ? valorStr.substring(0, 20) + '...' : valorStr;

      case 'renda_mensal':
        return 'R$ ***,**';

      default:
        return valorStr;
    }
  }

  // =====================================================
  // Métodos de Busca e Filtros
  // =====================================================

  async buscarHistoricoPorTexto(
    lojistaId: string,
    texto: string,
    limite: number = 20
  ): Promise<HistoricoCliente[]> {
    if (!supabase || supabaseError) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('historico_clientes')
        .select(`
          *,
          clientes!inner(nome, email, lojista_id)
        `)
        .eq('clientes.lojista_id', lojistaId)
        .or(`
          clientes.nome.ilike.%${texto}%,
          clientes.email.ilike.%${texto}%,
          motivo_alteracao.ilike.%${texto}%
        `)
        .order('data_alteracao', { ascending: false })
        .limit(limite);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.warn('Erro ao buscar histórico por texto:', error);
      return [];
    }
  }

  async obterUsuariosAtivos(lojistaId: string): Promise<Array<{
    id: string;
    nome: string;
    total_alteracoes: number;
  }>> {
    if (!supabase || supabaseError) {
      return [
        { id: 'demo-1', nome: 'Administrador', total_alteracoes: 89 },
        { id: 'demo-2', nome: 'Operador', total_alteracoes: 67 }
      ];
    }

    try {
      const { data, error } = await supabase
        .from('historico_clientes')
        .select(`
          usuario_id,
          clientes!inner(lojista_id)
        `)
        .eq('clientes.lojista_id', lojistaId)
        .not('usuario_id', 'is', null);

      if (error) throw error;

      // Agrupar por usuário e contar alterações
      const usuariosMap = new Map();
      
      data?.forEach((item: any) => {
        const userId = item.usuario_id;
        if (!usuariosMap.has(userId)) {
          usuariosMap.set(userId, {
            id: userId,
            nome: 'Usuário',
            total_alteracoes: 0
          });
        }
        usuariosMap.get(userId).total_alteracoes++;
      });

      return Array.from(usuariosMap.values())
        .sort((a, b) => b.total_alteracoes - a.total_alteracoes);
    } catch (error) {
      console.warn('Erro ao obter usuários ativos:', error);
      return [];
    }
  }

  // =====================================================
  // Métodos de Limpeza e Manutenção
  // =====================================================

  async limparHistoricoAntigo(): Promise<number> {
    if (!supabase || supabaseError) {
      return 0;
    }

    try {
      const { data, error } = await supabase.rpc('limpar_historico_antigo');

      if (error) throw error;

      return data || 0;
    } catch (error) {
      console.warn('Função de limpeza não encontrada:', error);
      return 0;
    }
  }

  // =====================================================
  // Métodos de Exportação
  // =====================================================

  async exportarHistorico(
    clienteId: string,
    formato: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const { historico } = await this.obterHistoricoCliente(clienteId, { limite: 1000 });

      if (formato === 'json') {
        return JSON.stringify(historico, null, 2);
      } else {
        return this.converterParaCSV(historico);
      }
    } catch (error) {
      console.error('Erro ao exportar histórico:', error);
      throw new Error('Falha ao exportar histórico');
    }
  }

  private converterParaCSV(historico: HistoricoCliente[]): string {
    const headers = [
      'Data/Hora',
      'Versão',
      'Operação',
      'Usuário',
      'Campos Alterados',
      'Motivo'
    ];

    const linhas = historico.map(item => [
      new Date(item.data_alteracao).toLocaleString('pt-BR'),
      item.versao.toString(),
      item.tipo_operacao,
      item.usuario_nome || 'Sistema',
      item.campos_alterados.join(', '),
      item.motivo_alteracao || ''
    ]);

    return [headers, ...linhas]
      .map(linha => linha.map(campo => `"${campo}"`).join(','))
      .join('\n');
  }
}

export const clientHistoryService = ClientHistoryService.getInstance();