import React, { useState, useEffect } from 'react';
import { ArrowLeft, Filter, Download, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, supabaseError } from '../../lib/supabaseClient';
import SupabaseError from '../../components/SupabaseError';
import { Transacao } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const PortalHistorico: React.FC = () => {
  const { user } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError || !user) {
      setLoading(false);
      return;
    }
    
    // Assuming the `clientes.id` is the same as the `auth.users.id`
    const clienteId = user.id;

    const fetchHistory = async () => {
      setLoading(true);
      const { data, error } = await supabase!
        .from('transacoes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_transacao', { ascending: false });

      if (error) console.error('Error fetching history:', error);
      else setTransacoes(data || []);
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/portal/dashboard" className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2"><ArrowLeft className="w-4 h-4 mr-2" />Voltar para o Dashboard</Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between"><h2 className="text-3xl font-bold text-gray-900">Meu Histórico</h2><div className="flex items-center gap-2 mt-4 sm:mt-0"><button className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center"><Filter className="w-4 h-4 mr-2" /> Filtrar</button><button className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center"><Download className="w-4 h-4 mr-2" /> Exportar</button></div></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor (R$)</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
              ) : transacoes.length === 0 ? (
                 <tr><td colSpan={3} className="text-center py-10 text-gray-500">Nenhuma transação encontrada.</td></tr>
              ) : (
                transacoes.map((t) => (<tr key={t.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(t.data_transacao).toLocaleDateString('pt-BR')}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.descricao}</td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-800">{t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortalHistorico;
