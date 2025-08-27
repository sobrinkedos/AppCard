import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Calendar, FileText, Barcode, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, supabaseError } from '../../lib/supabaseClient';
import SupabaseError from '../../components/SupabaseError';
import { Transacao } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const PortalDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  useEffect(() => {
    if (supabaseError || !user) {
      setLoading(false);
      return;
    }
    
    // Assuming the `clientes.id` is the same as the `auth.users.id`
    const clienteId = user.id;

    const fetchData = async () => {
      setLoading(true);
      const { data: dashData, error: dashError } = await supabase!
        .rpc('get_portal_dashboard_data', { p_cliente_id: clienteId });
      
      const { data: transacoesData, error: transacoesError } = await supabase!
        .from('transacoes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_transacao', { ascending: false })
        .limit(5);

      if (dashError) {
        console.error('Error fetching dashboard data:', dashError);
        setDashboardData(null);
      } else {
        setDashboardData(dashData);
      }

      if (transacoesError) console.error('Error fetching transactions:', transacoesError);
      else setTransacoes(transacoesData || []);
      
      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!dashboardData) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800">Bem-vindo!</h3>
        <p className="text-gray-600 mt-2">Não foi possível carregar os dados do seu cartão. Isso pode acontecer se o seu perfil de cliente ainda não estiver vinculado à sua conta.</p>
        <p className="text-sm text-gray-500 mt-4">Por favor, entre em contato com o suporte se o problema persistir.</p>
      </div>
    );
  }

  const { nome_cliente, limite_disponivel, fatura_atual, proximo_vencimento, limite_total } = dashboardData;
  const saldoUtilizado = limite_total - limite_disponivel;

  const stats = [
    { title: 'Limite Disponível', value: `R$ ${limite_disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign },
    { title: 'Fatura Atual', value: `R$ ${fatura_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CreditCard },
    { title: 'Próximo Vencimento', value: new Date(proximo_vencimento).toLocaleDateString('pt-BR'), icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div><h2 className="text-3xl font-bold text-gray-900">Olá, {nome_cliente}!</h2><p className="text-gray-600 mt-2">Aqui está um resumo do seu cartão.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (<div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><div className="flex items-center"><div className="p-3 bg-blue-100 rounded-full mr-4"><Icon className="w-6 h-6 text-blue-600" /></div><div><p className="text-sm font-medium text-gray-600">{stat.title}</p><p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p></div></div></div>);
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200"><div className="p-6 border-b border-gray-200 flex justify-between items-center"><h3 className="text-lg font-semibold text-gray-900">Últimas Compras</h3><Link to="/portal/historico" className="text-sm text-blue-600 hover:underline">Ver todas</Link></div><div className="p-6">{transacoes.map(t => (<div key={t.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"><div><p className="font-medium text-gray-800">{t.descricao}</p><p className="text-sm text-gray-500">{new Date(t.data_transacao).toLocaleDateString('pt-BR')}</p></div><p className="font-semibold text-gray-900">R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>))}</div></div>
        <div className="space-y-6"><div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><h3 className="text-lg font-semibold text-gray-900 mb-4">Limite de Crédito</h3><div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-blue-600 h-4 rounded-full" style={{ width: `${(saldoUtilizado / limite_total) * 100}%` }}></div></div><div className="flex justify-between text-sm mt-2"><span>R$ {saldoUtilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><span>R$ {limite_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div><div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3"><button className="w-full bg-green-600 text-white py-2 rounded-lg flex items-center justify-center"><FileText className="w-4 h-4 mr-2" /> Ver Fatura Completa</button><button className="w-full bg-gray-700 text-white py-2 rounded-lg flex items-center justify-center"><Barcode className="w-4 h-4 mr-2" /> Gerar Boleto / PIX</button></div></div>
      </div>
    </div>
  );
};

export default PortalDashboard;
