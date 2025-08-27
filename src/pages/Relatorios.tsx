import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Download, FileText, TrendingUp, Users, Calendar, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import SupabaseError from '../components/SupabaseError';

const Relatorios: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedReport, setSelectedReport] = useState('vendas');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>({
    kpis: { receita: 0, novosClientes: 0, inadimplencia: 0, cartoesAtivos: 0 },
    salesChart: [],
    clientsChart: [],
    defaultsChart: []
  });

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }

    const fetchReportData = async () => {
      setLoading(true);
      const { data, error } = await supabase!.rpc('get_reports_data');
      if (error) {
        console.error('Erro ao buscar dados dos relatórios:', error);
      } else {
        setReportData(data);
      }
      setLoading(false);
    };

    fetchReportData();
  }, []);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const salesChartOption = {
    title: { text: 'Vendas por Período', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: reportData.salesChart.map((d: any) => d.month) },
    yAxis: { type: 'value', axisLabel: { formatter: 'R$ {value}' } },
    series: [{ data: reportData.salesChart.map((d: any) => d.total_sales), type: 'line', smooth: true }]
  };

  const clientsChartOption = {
    title: { text: 'Clientes por Status', left: 'center' },
    tooltip: { trigger: 'item' },
    series: [{ name: 'Clientes', type: 'pie', radius: ['40%', '70%'], data: reportData.clientsChart.map((d: any) => ({ value: d.count, name: d.status })) }]
  };

  const defaultsChartOption = {
    title: { text: 'Taxa de Inadimplência Mensal', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: reportData.defaultsChart.map((d: any) => d.month) },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    series: [{ data: reportData.defaultsChart.map((d: any) => d.rate), type: 'bar' }]
  };

  const reports = [
    { id: 'vendas', name: 'Relatório de Vendas', icon: TrendingUp },
    { id: 'clientes', name: 'Análise de Clientes', icon: Users },
    { id: 'inadimplencia', name: 'Relatório de Inadimplência', icon: FileText },
    { id: 'mensal', name: 'Resumo Mensal', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Relatórios</h2>
          <p className="text-gray-600 mt-2">Análises e exportação de dados</p>
        </div>
        <button className="mt-4 sm:mt-0 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center">
          <Download className="w-5 h-5 mr-2" />
          Exportar Relatório
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-600">Receita Total</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">R$ {reportData.kpis.receita.toLocaleString('pt-BR')}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-600">Novos Clientes</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{reportData.kpis.novosClientes}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-600">Taxa de Inadimplência</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{reportData.kpis.inadimplencia.toFixed(1)}%</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-600">Cartões Ativos</div>
              <div className="text-2xl font-bold text-gray-900 mt-2">{reportData.kpis.cartoesAtivos}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><ReactECharts option={salesChartOption} style={{ height: '400px' }} /></div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><ReactECharts option={clientsChartOption} style={{ height: '400px' }} /></div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><ReactECharts option={defaultsChartOption} style={{ height: '400px' }} /></div>
        </>
      )}
    </div>
  );
};

export default Relatorios;
