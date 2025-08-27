import React, { useState, useEffect } from 'react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Calendar, DollarSign, CreditCard, Filter, Download, Loader2 } from 'lucide-react';
import SupabaseError from '../components/SupabaseError';

interface Recebimento {
  id: string;
  cliente_id: string;
  competencia: string;
  data_vencimento: string;
  valor_total: number;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento: string;
  clientes: {
    nome: string;
    email: string;
    telefone: string;
  };
}

const RecebimentosPage: React.FC = () => {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    data_inicio: '',
    data_fim: '',
    forma_pagamento: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecebimentos = async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_recebimentos', {
        p_data_inicio: filters.data_inicio || null,
        p_data_fim: filters.data_fim || null,
        p_forma_pagamento: filters.forma_pagamento || null
      });

      if (error) {
        console.error('Erro ao buscar recebimentos:', error);
      } else {
        setRecebimentos(data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar recebimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }
    fetchRecebimentos();
  }, []);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecebimentos();
  };

  const clearFilters = () => {
    setFilters({
      data_inicio: '',
      data_fim: '',
      forma_pagamento: ''
    });
    setTimeout(() => fetchRecebimentos(), 100);
  };

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const totalRecebido = recebimentos.reduce((sum, r) => sum + r.valor_pago, 0);
  const totalFaturas = recebimentos.length;
  const formasPagamento = recebimentos.reduce((acc, r) => {
    acc[r.forma_pagamento] = (acc[r.forma_pagamento] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Recebimentos</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </button>
          <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início
              </label>
              <input
                type="date"
                value={filters.data_inicio}
                onChange={(e) => setFilters(prev => ({ ...prev, data_inicio: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                value={filters.data_fim}
                onChange={(e) => setFilters(prev => ({ ...prev, data_fim: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={filters.forma_pagamento}
                onChange={(e) => setFilters(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Boleto">Boleto</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Limpar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full mr-4">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Recebido</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Faturas Pagas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalFaturas}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full mr-4">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Forma Mais Usada</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Object.keys(formasPagamento).length > 0 
                  ? Object.entries(formasPagamento).sort(([,a], [,b]) => b - a)[0][0]
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Recebimentos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Competência
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Pagamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Forma Pagamento
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recebimentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Nenhum recebimento encontrado
                    </td>
                  </tr>
                ) : (
                  recebimentos.map((recebimento) => (
                    <tr key={recebimento.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {recebimento.clientes.nome}
                          </div>
                          <div className="text-sm text-gray-500">
                            {recebimento.clientes.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {recebimento.competencia}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(recebimento.data_pagamento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        R$ {recebimento.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {recebimento.forma_pagamento}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecebimentosPage;