import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Transacao } from '../types';
import SupabaseError from '../components/SupabaseError';

const Transacoes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }

    const fetchTransacoes = async () => {
      setLoading(true);
      let query = supabase!
        .from('transacoes')
        .select('*, clientes(nome), cartoes(numero_cartao)')
        .order('data_transacao', { ascending: false });

      if (searchTerm) {
        query = query.or(`descricao.ilike.%${searchTerm}%,clientes.nome.ilike.%${searchTerm}%`);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) console.error('Erro ao buscar transações:', error);
      else if (data) setTransacoes(data as any);
      setLoading(false);
    };

    const delayDebounceFn = setTimeout(() => {
      fetchTransacoes();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, statusFilter]);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const totalTransacoes = transacoes.length;
  const totalValor = transacoes.reduce((sum, t) => sum + t.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Transações</h2>
          <p className="text-gray-600 mt-2">Extrato de movimentações financeiras</p>
        </div>
        <button className="mt-4 sm:mt-0 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center">
          <Download className="w-5 h-5 mr-2" />
          Exportar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600">Total de Transações</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{totalTransacoes}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600">Valor Total</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600">Valor Médio</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">R$ {(totalValor / totalTransacoes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Buscar transações..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">Todos os status</option>
            <option value="Paga">Paga</option>
            <option value="Pendente">Pendente</option>
            <option value="Atrasada">Atrasada</option>
            <option value="Cancelada">Cancelada</option>
          </select>
          <input type="date" className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 mr-2" />
            Filtros avançados
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cartão</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parcela</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
              ) : (
                transacoes.map((transacao) => (
                  <tr key={transacao.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{transacao.descricao}</div>
                        <div className="text-sm text-gray-500">{new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}</div>
                        <div className="text-xs text-blue-600">{transacao.categoria}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transacao.clientes?.nome}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{transacao.cartoes?.numero_cartao}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">R$ {transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transacao.parcela_atual}/{transacao.total_parcelas}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ transacao.status === 'Paga' ? 'bg-green-100 text-green-800' : transacao.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' : transacao.status === 'Atrasada' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800' }`}>{transacao.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transacoes;
