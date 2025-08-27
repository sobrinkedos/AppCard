import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Cliente, Cartao, Transacao, Fatura } from '../types';
import { ArrowLeft, Edit2, Lock, Mail, User, Phone, MapPin, DollarSign, CreditCard, ShoppingCart, TrendingUp, Eye, FileText, Loader2 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import SupabaseError from '../components/SupabaseError';
import CreditScoreCard from '../components/CreditScoreCard';
import ClientHistoryViewer from '../components/ClientHistoryViewer';

const ClienteDetalhes: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cartao, setCartao] = useState<Cartao | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError || !id) {
      // Dados de demonstração quando Supabase não está disponível
      setCliente({
        id: id || '1',
        nome: 'Maria Silva',
        cpf: '12345678901',
        email: 'maria@email.com',
        telefone: '11999999999',
        endereco: 'Rua das Flores, 123, São Paulo - SP',
        limite_credito: 5000,
        dia_vencimento: 10,
        status: 'Ativo',
        data_cadastro: '2024-08-15'
      });

      setCartao({
        id: '1',
        cliente_id: id || '1',
        numero_cartao: '**** **** **** 1234',
        cvv: '***',
        data_validade: '12/28',
        limite: 5000,
        saldo_utilizado: 1250,
        status: 'Ativo',
        design: 'Clássico',
        data_emissao: '2024-08-15'
      });

      setTransacoes([
        {
          id: '1',
          cartao_id: '1',
          cliente_id: id || '1',
          descricao: 'Supermercado ABC',
          valor: 150.00,
          categoria: 'Alimentação',
          parcela_atual: 1,
          total_parcelas: 1,
          status: 'Paga',
          data_transacao: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '2',
          cartao_id: '1',
          cliente_id: id || '1',
          descricao: 'Posto de Gasolina XYZ',
          valor: 200.00,
          categoria: 'Combustível',
          parcela_atual: 1,
          total_parcelas: 1,
          status: 'Paga',
          data_transacao: new Date(Date.now() - 172800000).toISOString()
        },
        {
          id: '3',
          cartao_id: '1',
          cliente_id: id || '1',
          descricao: 'Loja de Roupas DEF',
          valor: 300.00,
          categoria: 'Vestuário',
          parcela_atual: 1,
          total_parcelas: 3,
          status: 'Pendente',
          data_transacao: new Date(Date.now() - 259200000).toISOString()
        }
      ]);

      setFaturas([
        {
          id: '1',
          cliente_id: id || '1',
          competencia: '2024-08',
          data_vencimento: '2024-09-10',
          data_fechamento: '2024-08-31',
          valor_total: 650.00,
          pagamento_minimo: 65.00,
          status: 'Aberta',
          data_criacao: '2024-08-31'
        }
      ]);

      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      try {
        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single();
        
        if (clienteError) {
          console.error("Erro ao buscar cliente:", clienteError);
        } else {
          setCliente(clienteData);
        }

        // Tentar buscar cartão, mas não falhar se a tabela não existir
        try {
          const { data: cartaoData, error: cartaoError } = await supabase
            .from('cartoes')
            .select('*')
            .eq('cliente_id', id)
            .single();

          if (cartaoError && cartaoError.code !== 'PGRST116') {
            console.warn("Tabela cartoes não encontrada, usando dados de demonstração");
          } else if (cartaoData) {
            setCartao(cartaoData);
          }
        } catch (error) {
          console.warn("Erro ao buscar cartão, usando dados de demonstração:", error);
        }

        // Tentar buscar transações, mas não falhar se a tabela não existir
        try {
          const { data: transacoesData, error: transacoesError } = await supabase
            .from('transacoes')
            .select('*')
            .eq('cliente_id', id)
            .order('data_transacao', { ascending: false })
            .limit(8);

          if (transacoesError && transacoesError.code !== 'PGRST116') {
            console.warn("Tabela transacoes não encontrada, usando dados de demonstração");
          } else if (transacoesData) {
            setTransacoes(transacoesData);
          }
        } catch (error) {
          console.warn("Erro ao buscar transações, usando dados de demonstração:", error);
        }

        // Tentar buscar faturas, mas não falhar se a tabela não existir
        try {
          const { data: faturasData, error: faturasError } = await supabase
            .from('faturas')
            .select('*')
            .eq('cliente_id', id)
            .in('status', ['Aberta', 'Atrasada', 'Parcialmente Paga']);

          if (faturasError && faturasError.code !== 'PGRST116') {
            console.warn("Tabela faturas não encontrada, usando dados de demonstração");
          } else if (faturasData) {
            setFaturas(faturasData || []);
          }
        } catch (error) {
          console.warn("Erro ao buscar faturas, usando dados de demonstração:", error);
        }

      } catch (error) {
        console.error('Erro inesperado:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!cliente) {
    return <div className="text-center p-8">Cliente não encontrado.</div>;
  }

  // Se não há cartão, criar um de demonstração
  const cartaoAtual = cartao || {
    id: '1',
    cliente_id: cliente.id,
    numero_cartao: '**** **** **** 1234',
    cvv: '***',
    data_validade: '12/28',
    limite: cliente.limite_credito,
    saldo_utilizado: Math.floor(cliente.limite_credito * 0.3),
    status: 'Ativo' as const,
    design: 'Clássico',
    data_emissao: cliente.data_cadastro
  };

  // Calcular saldo devedor real baseado nas faturas em aberto
  const saldoDevedorReal = faturas.reduce((total, fatura) => {
    const valorDevedor = fatura.valor_total - ((fatura as any).valor_pago || 0);
    return total + valorDevedor;
  }, 0);

  // Calcular limite disponível
  const limiteDisponivel = cliente.limite_credito - saldoDevedorReal;

  // Calcular total gasto real (soma de todas as transações processadas)
  const totalGastoReal = transacoes.reduce((total, transacao) => total + transacao.valor, 0);

  const stats = [
    { title: 'Total Gasto', value: `R$ ${totalGastoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: ShoppingCart },
    { title: 'Limite de Crédito', value: `R$ ${cliente.limite_credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign },
    { title: 'Saldo Devedor', value: `R$ ${saldoDevedorReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CreditCard },
    { title: 'Limite Disponível', value: `R$ ${limiteDisponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp },
  ];

  const spendingChartOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: transacoes.map(t => new Date(t.data_transacao).toLocaleDateString('pt-BR')).reverse() },
    yAxis: { type: 'value' },
    series: [{ data: transacoes.map(t => t.valor).reverse(), type: 'line', smooth: true, itemStyle: { color: '#3B82F6' } }],
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  };

  return (
    <div className="space-y-6">
      {supabaseError && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Modo Demonstração</h3>
              <p className="text-sm text-blue-600">Você está visualizando dados de exemplo. Conecte seu projeto Supabase para ver dados reais do cliente.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/clientes" className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2"><ArrowLeft className="w-4 h-4 mr-2" />Voltar para Clientes</Link>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900">{cliente.nome}</h2>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ cliente.status === 'Ativo' ? 'bg-green-100 text-green-800' : cliente.status === 'Inativo' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800' }`}>{cliente.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/clientes/${id}/faturas`} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center"><FileText className="w-4 h-4 mr-2" /> Ver Faturas</Link>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center"><Edit2 className="w-4 h-4 mr-2" /> Editar</button>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"><Lock className="w-4 h-4 mr-2" /> Bloquear</button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"><Mail className="w-4 h-4 mr-2" /> Mensagem</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center"><Icon className="w-6 h-6 text-blue-600" /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Score de Crédito */}
          <CreditScoreCard 
            clienteId={cliente.id} 
            showDetails={true}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Pessoais</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center"><User className="w-4 h-4 mr-3 text-gray-400" /> <span className="font-medium text-gray-800">{cliente.nome}</span></div>
              <div className="flex items-center"><Mail className="w-4 h-4 mr-3 text-gray-400" /> <span className="text-gray-600">{cliente.email}</span></div>
              <div className="flex items-center"><Phone className="w-4 h-4 mr-3 text-gray-400" /> <span className="text-gray-600">{cliente.telefone}</span></div>
              <div className="flex items-center"><MapPin className="w-4 h-4 mr-3 text-gray-400" /> <span className="text-gray-600">{cliente.endereco}</span></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cartão Vinculado</h3>
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-4 text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8"><div className="text-xs font-medium opacity-80">CardSaaS</div><div className="text-xs opacity-80">{cartaoAtual.design || 'Clássico'}</div></div>
                <div className="text-lg font-mono tracking-wider mb-4">{cartaoAtual.numero_cartao}</div>
                <div className="flex justify-between items-end">
                  <div><div className="text-xs opacity-80">TITULAR</div><div className="font-medium text-sm">{cliente.nome.toUpperCase()}</div></div>
                  <div className="text-xs opacity-80">{new Date(cartaoAtual.data_emissao).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Gastos Recentes</h3>
            <ReactECharts option={spendingChartOption} style={{ height: '250px' }} />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Transações Recentes</h3></div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transacoes.map((transacao) => (
                    <tr key={transacao.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transacao.descricao}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">R$ {transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ transacao.status === 'Paga' ? 'bg-green-100 text-green-800' : transacao.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800' }`}>{transacao.status}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico de Alterações */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Histórico de Alterações</h3>
            </div>
            <ClientHistoryViewer 
              clienteId={cliente.id}
              clienteNome={cliente.nome}
              mostrarFiltros={true}
              altura="h-80"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClienteDetalhes;
