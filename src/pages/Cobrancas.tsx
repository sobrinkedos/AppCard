import React, { useState, useEffect } from 'react';
import { AlertTriangle, Send, Phone, Eye, Calendar, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Fatura } from '../types';
import SupabaseError from '../components/SupabaseError';

interface Cobranca extends Fatura {
  clientes: { nome: string };
  dias_atraso: number;
  status_cobranca: 'Crítica' | 'Em atraso' | 'Vencida' | 'Em dia';
}

const Cobrancas: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedCobranca, setSelectedCobranca] = useState<Cobranca | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }

    const fetchCobrancas = async () => {
      setLoading(true);
      const { data, error } = await supabase!.rpc('get_cobrancas');
      if (error) console.error('Erro ao buscar cobranças:', error);
      else if (data) setCobrancas(data);
      setLoading(false);
    };
    fetchCobrancas();
  }, []);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const cobrancasCriticas = cobrancas.filter(c => c.status_cobranca === 'Crítica').length;
  const cobrancasEmAtraso = cobrancas.filter(c => c.status_cobranca === 'Em atraso').length;
  const valorTotalAtraso = cobrancas
    .filter(c => c.status === 'Atrasada')
    .reduce((sum, c) => sum + c.valor_total, 0);

  const handleEnviarCobranca = (cobranca: Cobranca) => {
    setSelectedCobranca(cobranca);
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Cobranças</h2>
          <p className="text-gray-600 mt-2">Gerencie parcelas e alertas de inadimplência</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <div className="text-sm font-medium text-red-800">Cobranças Críticas</div>
              <div className="text-2xl font-bold text-red-900 mt-1">{cobrancasCriticas}</div>
              <div className="text-sm text-red-700">+30 dias de atraso</div>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-yellow-600 mr-3" />
            <div>
              <div className="text-sm font-medium text-yellow-800">Em Atraso</div>
              <div className="text-2xl font-bold text-yellow-900 mt-1">{cobrancasEmAtraso}</div>
              <div className="text-sm text-yellow-700">7-30 dias de atraso</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3"><span className="text-white font-bold text-sm">R$</span></div>
            <div>
              <div className="text-sm font-medium text-blue-800">Valor em Atraso</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">R$ {valorTotalAtraso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-blue-700">Total a receber</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Lista de Faturas em Aberto/Atraso</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Competência</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cobrancas.map((cobranca) => (
                <tr key={cobranca.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{typeof cobranca.clientes === 'object' && cobranca.clientes ? cobranca.clientes.nome : 'Cliente não encontrado'}</div>
                      <div className="text-sm text-gray-500">Fatura {cobranca.competencia}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">R$ {cobranca.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}</div>
                    {cobranca.dias_atraso > 0 && (<div className="text-xs text-red-600">{cobranca.dias_atraso} dias de atraso</div>)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ cobranca.status_cobranca === 'Em dia' ? 'bg-green-100 text-green-800' : cobranca.status_cobranca === 'Vencida' ? 'bg-yellow-100 text-yellow-800' : cobranca.status_cobranca === 'Em atraso' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800' }`}>{cobranca.status_cobranca}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleEnviarCobranca(cobranca)} className="text-green-600 hover:text-green-800" title="Enviar cobrança"><Send className="w-4 h-4" /></button>
                      <button className="text-yellow-600 hover:text-yellow-800" title="Ligar para cliente"><Phone className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedCobranca && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Enviar Cobrança</h3>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Cliente:</div><div className="font-medium">{typeof selectedCobranca.clientes === 'object' && selectedCobranca.clientes ? selectedCobranca.clientes.nome : 'Cliente não encontrado'}</div>
              <div className="text-sm text-gray-600 mt-2">Valor:</div><div className="font-medium text-lg">R$ {selectedCobranca.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="text-sm text-gray-600 mt-2">Dias de atraso:</div><div className="font-medium text-red-600">{selectedCobranca.dias_atraso} dias</div>
            </div>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Cobrança</label>
                <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Modelo de Mensagem</label>
                <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="lembrete">Lembrete Amigável</option><option value="primeira">Primeira Cobrança</option><option value="segunda">Segunda Cobrança</option><option value="final">Notificação Final</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mensagem Personalizada</label>
                <textarea rows={4} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Digite uma mensagem personalizada (opcional)"/>
              </div>
            </form>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"><Send className="w-4 h-4 mr-2" />Enviar Cobrança</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cobrancas;
