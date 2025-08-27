import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, Users, CreditCard, AlertTriangle, Loader2, DollarSign } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Transacao } from '../types';
import SupabaseError from '../components/SupabaseError';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cartoesAtivos: 0,
    vendasMes: 0,
    totalClientes: 0,
    taxaInadimplencia: 0,
    recebimentosMes: 0,
  });
  const [recentes, setRecentes] = useState<Transacao[]>([]);
  const [salesChartData, setSalesChartData] = useState([]);
  const [cardsChartData, setCardsChartData] = useState([]);

  useEffect(() => {
    if (supabaseError) {
      // Dados de demonstração quando Supabase não está disponível
      setStats({
        cartoesAtivos: 1250,
        vendasMes: 45780.50,
        totalClientes: 892,
        taxaInadimplencia: 2.3,
        recebimentosMes: 38920.75,
      });
      
      setRecentes([
        {
          id: '1',
          valor: 150.00,
          status: 'Paga',
          data_transacao: new Date().toISOString(),
          clientes: { nome: 'Maria Silva' }
        },
        {
          id: '2',
          valor: 89.90,
          status: 'Pendente',
          data_transacao: new Date(Date.now() - 86400000).toISOString(),
          clientes: { nome: 'João Santos' }
        },
        {
          id: '3',
          valor: 320.75,
          status: 'Paga',
          data_transacao: new Date(Date.now() - 172800000).toISOString(),
          clientes: { nome: 'Ana Costa' }
        }
      ] as any);
      
      setSalesChartData([
        { month: 'Jan', total_sales: 35000 },
        { month: 'Fev', total_sales: 42000 },
        { month: 'Mar', total_sales: 38000 },
        { month: 'Abr', total_sales: 45000 },
        { month: 'Mai', total_sales: 41000 },
        { month: 'Jun', total_sales: 48000 }
      ] as any);
      
      setCardsChartData([
        { status: 'Ativo', count: 850 },
        { status: 'Bloqueado', count: 120 },
        { status: 'Cancelado', count: 80 },
        { status: 'Pendente', count: 200 }
      ] as any);
      
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      try {
        const [
          { data: dashboardStats },
          { data: transacoesRecentesData },
          { data: vendasPorMesData },
          { data: cartoesPorStatusData },
          { data: recebimentosMesData }
        ] = await Promise.all([
          supabase!.rpc('get_dashboard_stats'),
          supabase!.from('transacoes').select('*, clientes(nome)').order('data_transacao', { ascending: false }).limit(5),
          supabase!.rpc('get_sales_last_6_months'),
          supabase!.rpc('get_card_status_counts'),
          supabase!.from('faturas').select('valor_pago').eq('status', 'Paga').gte('data_pagamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        ]);

        if (dashboardStats && Array.isArray(dashboardStats) && dashboardStats.length > 0) {
          const data = dashboardStats[0];
          const recebimentosMes = recebimentosMesData?.reduce((sum, fatura) => sum + (fatura.valor_pago || 0), 0) || 0;
          setStats({
            cartoesAtivos: data.cartoesativos || 0,
            vendasMes: parseFloat(data.vendasmes) || 0,
            totalClientes: data.totalclientes || 0,
            taxaInadimplencia: parseFloat(data.taxainadimplencia) || 0,
            recebimentosMes: recebimentosMes,
          });
        }
        if (transacoesRecentesData) setRecentes(transacoesRecentesData as any);
        if (vendasPorMesData) setSalesChartData(vendasPorMesData as any);
        if (cartoesPorStatusData) setCardsChartData(cartoesPorStatusData as any);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const statCards = [
    { title: 'Cartões Ativos', value: stats.cartoesAtivos.toLocaleString('pt-BR'), icon: CreditCard },
    { title: 'Vendas do Mês', value: `R$ ${stats.vendasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp },
    { title: 'Recebimentos do Mês', value: `R$ ${stats.recebimentosMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign },
    { title: 'Total de Clientes', value: stats.totalClientes.toLocaleString('pt-BR'), icon: Users },
    { title: 'Taxa de Inadimplência', value: `${stats.taxaInadimplencia.toFixed(1)}%`, icon: AlertTriangle },
  ];

  const salesChartOption = {
    title: { text: 'Vendas dos Últimos 6 Meses', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: salesChartData.map((d: any) => d.month) },
    yAxis: { type: 'value', axisLabel: { formatter: 'R$ {value}' } },
    series: [{ data: salesChartData.map((d: any) => d.total_sales), type: 'line', smooth: true }]
  };

  const cardsChartOption = {
    title: { text: 'Status dos Cartões', left: 'center' },
    tooltip: { trigger: 'item' },
    series: [{ name: 'Cartões', type: 'pie', radius: '60%', data: cardsChartData.map((d: any) => ({ value: d.count, name: d.status }))}]
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {supabaseError && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Modo Demonstração</h3>
              <p className="text-sm text-blue-600">Você está visualizando dados de exemplo. Conecte seu projeto Supabase para ver dados reais.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-2">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><ReactECharts option={salesChartOption} style={{ height: '350px' }} /></div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><ReactECharts option={cardsChartOption} style={{ height: '350px' }} /></div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Transações Recentes</h3></div>
        <div className="p-6">
          <div className="space-y-4">
            {recentes.map((transacao) => (
              <div key={transacao.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{transacao.clientes?.nome}</p>
                  <p className="text-sm text-gray-500">{new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">R$ {transacao.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    transacao.status === 'Paga' ? 'bg-green-100 text-green-800' :
                    transacao.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>{transacao.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
