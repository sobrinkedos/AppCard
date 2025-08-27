import React, { useState, useEffect } from 'react';
import { Search, Plus, CreditCard, ShoppingCart, Calendar, DollarSign, FileText, Loader2, Check, X } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import SupabaseError from '../components/SupabaseError';
import { Cliente, Cartao } from '../types';
import AssinaturaFaturaModal from '../components/AssinaturaFaturaModal';

interface Venda {
  id: string;
  cliente_id: string;
  cartao_id: string;
  descricao: string;
  valor: number;
  categoria: string;
  parcela_atual: number;
  total_parcelas: number;
  status: 'Paga' | 'Pendente' | 'Atrasada' | 'Cancelada';
  data_transacao: string;
  cliente_nome?: string;
  cartao_numero?: string;
}

interface FormData {
  cliente_id: string;
  cartao_id: string;
  descricao: string;
  valor: string;
  categoria: string;
  tipo_pagamento: 'unico' | 'parcelado';
  total_parcelas: number;
}

const Vendas: React.FC = () => {
  const { user } = useAuth();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cartoesCliente, setCartoesCliente] = useState<Cartao[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAssinaturaModal, setShowAssinaturaModal] = useState(false);
  const [faturaParaAssinar, setFaturaParaAssinar] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    cliente_id: '',
    cartao_id: '',
    descricao: '',
    valor: '',
    categoria: '',
    tipo_pagamento: 'unico',
    total_parcelas: 1
  });

  // Buscar dados
  useEffect(() => {
    if (user) {
      fetchVendas();
      fetchClientes();
      fetchCartoes();
    }
  }, [user]);

  // Buscar cartões quando cliente for selecionado
  useEffect(() => {
    if (formData.cliente_id) {
      fetchCartoesCliente(formData.cliente_id);
    } else {
      setCartoesCliente([]);
    }
  }, [formData.cliente_id]);

  const fetchVendas = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transacoes')
        .select(`
          *,
          clientes!inner(nome),
          cartoes!inner(numero_cartao)
        `)
        .eq('lojista_id', user.id)
        .order('data_transacao', { ascending: false });

      if (error) throw error;
      
      const vendasFormatadas = data?.map(item => ({
        ...item,
        cliente_nome: item.clientes?.nome,
        cartao_numero: item.cartoes?.numero_cartao
      })) || [];
      
      setVendas(vendasFormatadas);
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      setError('Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('lojista_id', user.id)
        .eq('status', 'Ativo')
        .order('nome');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const fetchCartoes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('cartoes')
        .select(`
          *,
          clientes!inner(nome)
        `)
        .eq('lojista_id', user.id)
        .eq('status', 'Ativo')
        .order('numero_cartao');

      if (error) throw error;
      setCartoes(data || []);
    } catch (error) {
      console.error('Erro ao buscar cartões:', error);
    }
  };

  const fetchCartoesCliente = async (clienteId: string) => {
    if (!user || !clienteId) {
      setCartoesCliente([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('cartoes')
        .select('*')
        .eq('lojista_id', user.id)
        .eq('cliente_id', clienteId)
        .eq('status', 'Ativo')
        .order('numero_cartao');

      if (error) throw error;
      setCartoesCliente(data || []);
    } catch (error) {
      console.error('Erro ao buscar cartões do cliente:', error);
      setCartoesCliente([]);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;

    try {
      setSaving(true);
      setError(null);

      // Validações
      if (!formData.cliente_id || !formData.cartao_id || !formData.descricao || !formData.valor) {
        throw new Error('Todos os campos obrigatórios devem ser preenchidos');
      }

      const valor = parseFloat(formData.valor);
      if (isNaN(valor) || valor <= 0) {
        throw new Error('Valor deve ser um número positivo');
      }

      // Verificar limite disponível do cartão
      const cartaoSelecionado = cartoesCliente.find(c => c.id === formData.cartao_id);
      if (!cartaoSelecionado) {
        throw new Error('Cartão não encontrado');
      }

      const limiteDisponivel = cartaoSelecionado.limite - cartaoSelecionado.saldo_utilizado;
      if (valor > limiteDisponivel) {
        throw new Error(`Limite insuficiente. Disponível: R$ ${limiteDisponivel.toFixed(2)}`);
      }

      let transacaoOriginalId: string;
      let faturaId: string;

      if (formData.tipo_pagamento === 'parcelado' && formData.total_parcelas > 1) {
        // Usar função de parcelamento para criar múltiplas faturas
        const { data: resultado, error: parcelamentoError } = await supabase
          .rpc('criar_faturas_parceladas', {
            p_lojista_id: user.id,
            p_cliente_id: formData.cliente_id,
            p_cartao_id: formData.cartao_id,
            p_descricao: formData.descricao,
            p_valor_total: valor,
            p_categoria: formData.categoria,
            p_total_parcelas: formData.total_parcelas
          });

        if (parcelamentoError) throw parcelamentoError;
        transacaoOriginalId = resultado;

        // Buscar a primeira fatura criada para exibir no modal de assinatura
        const { data: primeiraTransacao, error: transacaoError } = await supabase
          .from('transacoes')
          .select('fatura_id')
          .eq('id', transacaoOriginalId)
          .single();

        if (transacaoError) throw transacaoError;
        faturaId = primeiraTransacao.fatura_id;
      } else {
        // Venda única - usar função de cálculo de data de vencimento
        const { data: dataVencimentoResult, error: dataVencimentoError } = await supabase
          .rpc('calcular_data_vencimento', {
            p_lojista_id: user.id,
            p_meses_adicionar: 1,
            p_cliente_id: formData.cliente_id
          });

        if (dataVencimentoError) throw dataVencimentoError;
        
        const dataVencimento = new Date(dataVencimentoResult);
        const competencia = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}`;
        const dataFechamento = new Date(dataVencimento.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 dias antes

        // Verificar se já existe fatura para esta competência
        const { data: faturaExistente, error: faturaConsultaError } = await supabase
          .from('faturas')
          .select('id')
          .eq('lojista_id', user.id)
          .eq('cliente_id', formData.cliente_id)
          .eq('competencia', competencia)
          .eq('status', 'Aberta')
          .single();

        if (faturaConsultaError && faturaConsultaError.code !== 'PGRST116') {
          throw faturaConsultaError;
        }

        if (faturaExistente) {
          faturaId = faturaExistente.id;
        } else {
          // Criar nova fatura
          const { data: novaFatura, error: faturaError } = await supabase
            .from('faturas')
            .insert({
              lojista_id: user.id,
              cliente_id: formData.cliente_id,
              competencia,
              data_vencimento: dataVencimento.toISOString().split('T')[0],
              data_fechamento: dataFechamento.toISOString().split('T')[0],
              valor_total: valor,
              pagamento_minimo: valor * 0.15,
              status: 'Aberta'
            })
            .select('id')
            .single();

          if (faturaError) throw faturaError;
          faturaId = novaFatura.id;
        }

        // Criar transação única
        const { data: novaTransacao, error: transacaoError } = await supabase
          .from('transacoes')
          .insert({
            lojista_id: user.id,
            cliente_id: formData.cliente_id,
            cartao_id: formData.cartao_id,
            fatura_id: faturaId,
            descricao: formData.descricao,
            valor: valor,
            categoria: formData.categoria,
            parcela_atual: 1,
            total_parcelas: 1,
            status: 'Pendente'
          })
          .select('id')
          .single();

        if (transacaoError) throw transacaoError;
        transacaoOriginalId = novaTransacao.id;

        // O valor total da fatura será calculado automaticamente baseado nas transações
        // Recalcular valor total da fatura baseado nas transações
        if (faturaExistente) {
          // Buscar todas as transações desta fatura para recalcular o valor total
          const { data: transacoesFatura, error: transacoesError } = await supabase
            .from('transacoes')
            .select('valor')
            .eq('fatura_id', faturaId);

          if (transacoesError) throw transacoesError;

          const valorTotalCalculado = transacoesFatura.reduce((sum, t) => sum + t.valor, 0);
          const { error: atualizarFaturaError } = await supabase
            .from('faturas')
            .update({
              valor_total: valorTotalCalculado,
              pagamento_minimo: valorTotalCalculado * 0.15
            })
            .eq('id', faturaId);

          if (atualizarFaturaError) throw atualizarFaturaError;
        }
      }

      // 4. Atualizar saldo do cartão
      const { error: updateError } = await supabase
        .from('cartoes')
        .update({ 
          saldo_utilizado: cartaoSelecionado.saldo_utilizado + valor 
        })
        .eq('id', formData.cartao_id);

      if (updateError) throw updateError;

      // Reset form
      setFormData({
        cliente_id: '',
        cartao_id: '',
        descricao: '',
        valor: '',
        categoria: '',
        tipo_pagamento: 'unico',
        total_parcelas: 1
      });
      
      setShowModal(false);
      fetchVendas();
      fetchCartoes(); // Atualizar saldos
      
      // Preparar dados da fatura para assinatura
      const { data: faturaCompleta, error: faturaCompletaError } = await supabase
        .from('faturas')
        .select(`
          *,
          clientes (*),
          transacoes (*)
        `)
        .eq('id', faturaId)
        .single();

      if (faturaCompletaError) throw faturaCompletaError;

      setFaturaParaAssinatura(faturaCompleta);
      setShowAssinaturaModal(true);
      
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setError(null);
    setFormData({
      cliente_id: '',
      cartao_id: '',
      descricao: '',
      valor: '',
      categoria: '',
      tipo_pagamento: 'unico',
      total_parcelas: 1
    });
  };



  // Filtrar vendas
  const vendasFiltradas = vendas.filter(venda => {
    const matchesSearch = venda.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         venda.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         venda.categoria?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || venda.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Vendas</h2>
          <p className="text-gray-600 mt-1">Gerencie as vendas realizadas com cartões</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Venda
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full mr-4">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vendas</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {vendas.reduce((sum, v) => sum + v.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Transações</p>
              <p className="text-2xl font-bold text-gray-900">{vendas.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full mr-4">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">
                {vendas.filter(v => v.status === 'Pendente').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full mr-4">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {vendas.length > 0 ? (vendas.reduce((sum, v) => sum + v.valor, 0) / vendas.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar vendas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos os status</option>
            <option value="Paga">Paga</option>
            <option value="Pendente">Pendente</option>
            <option value="Atrasada">Atrasada</option>
            <option value="Cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Vendas List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Lista de Vendas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parcelas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendasFiltradas.map((venda) => (
                <tr key={venda.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{venda.cliente_nome}</div>
                      <div className="text-sm text-gray-500">**** {venda.cartao_numero?.slice(-4)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{venda.descricao}</div>
                    {venda.categoria && (
                      <div className="text-sm text-gray-500">{venda.categoria}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R$ {venda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {venda.parcela_atual}/{venda.total_parcelas}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      venda.status === 'Paga' ? 'bg-green-100 text-green-800' :
                      venda.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
                      venda.status === 'Atrasada' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {venda.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(venda.data_transacao).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendasFiltradas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhuma venda encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Venda */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Nova Venda</h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente *
                  </label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value, cartao_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={saving}
                  >
                    <option value="">Selecione um cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cartão *
                  </label>
                  <select
                    value={formData.cartao_id}
                    onChange={(e) => setFormData({ ...formData, cartao_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={saving || !formData.cliente_id}
                  >
                    <option value="">{!formData.cliente_id ? 'Selecione um cliente primeiro' : 'Selecione um cartão'}</option>
                    {cartoesCliente.map((cartao) => {
                      const limiteDisponivel = cartao.limite - cartao.saldo_utilizado;
                      return (
                        <option key={cartao.id} value={cartao.id}>
                          **** {cartao.numero_cartao.slice(-4)} - Limite: R$ {limiteDisponivel.toFixed(2)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição *
                  </label>
                  <input
                    type="text"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Compra no supermercado"
                    required
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0,00"
                    required
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Alimentação, Vestuário"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Pagamento
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="unico"
                        checked={formData.tipo_pagamento === 'unico'}
                        onChange={(e) => setFormData({ ...formData, tipo_pagamento: e.target.value as 'unico' | 'parcelado', total_parcelas: 1 })}
                        className="mr-2"
                        disabled={saving}
                      />
                      Pagamento Único
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="parcelado"
                        checked={formData.tipo_pagamento === 'parcelado'}
                        onChange={(e) => setFormData({ ...formData, tipo_pagamento: e.target.value as 'unico' | 'parcelado', total_parcelas: 2 })}
                        className="mr-2"
                        disabled={saving}
                      />
                      Parcelado
                    </label>
                  </div>
                </div>

                {formData.tipo_pagamento === 'parcelado' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Parcelas
                    </label>
                    <select
                      value={formData.total_parcelas}
                      onChange={(e) => setFormData({ ...formData, total_parcelas: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <option key={num} value={num}>
                          {num}x de R$ {formData.valor ? (parseFloat(formData.valor) / num).toFixed(2) : '0,00'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Registrar Venda'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Assinatura da Fatura */}
      {faturaParaAssinar && (
        <AssinaturaFaturaModal
          isOpen={showAssinaturaModal}
          onClose={() => {
            setShowAssinaturaModal(false);
            setFaturaParaAssinar(null);
          }}
          fatura={faturaParaAssinar}
          onAssinaturaConcluida={() => {
            alert('Venda registrada e fatura assinada com sucesso!');
            setShowAssinaturaModal(false);
            setFaturaParaAssinar(null);
          }}
        />
      )}


    </div>
  );
};

export default Vendas;