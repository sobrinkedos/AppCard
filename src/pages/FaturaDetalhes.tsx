import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Fatura, Transacao, Cliente } from '../types';
import { ArrowLeft, Download, Printer, Barcode, Calendar, FileCheck2, Loader2 } from 'lucide-react';
import SupabaseError from '../components/SupabaseError';

const FaturaDetalhes: React.FC = () => {
  const { id: clienteId, faturaId } = useParams<{ id: string; faturaId: string }>();
  const [cliente, setCliente] = useState<Pick<Cliente, 'nome'> | null>(null);
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError || !clienteId || !faturaId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      const { data: clienteData } = await supabase!.from('clientes').select('nome').eq('id', clienteId).single();
      setCliente(clienteData);

      const { data: faturaData } = await supabase!.from('faturas').select('*').eq('id', faturaId).single();
      setFatura(faturaData);

      if (faturaData) {
        const { data: transacoesData } = await supabase!
          .from('transacoes')
          .select('*')
          .eq('fatura_id', faturaId); // Assuming a fatura_id in transacoes table
        setTransacoes(transacoesData || []);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [clienteId, faturaId]);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!cliente || !fatura) {
    return <div className="text-center p-8">Fatura não encontrada.</div>;
  }

  // Calcular totais para verificação
  const totalLancamentos = transacoes.reduce((sum, t) => sum + t.valor, 0);
  const diferencaValores = Math.abs(totalLancamentos - fatura.valor_total) > 0.01;

  // Função para recalcular o valor total da fatura
  const recalcularValorFatura = async () => {
    try {
      const { error } = await supabase
        .from('faturas')
        .update({
          valor_total: totalLancamentos,
          pagamento_minimo: totalLancamentos * 0.15
        })
        .eq('id', faturaId);

      if (error) throw error;

      // Recarregar a página para mostrar os valores atualizados
      window.location.reload();
    } catch (error) {
      console.error('Erro ao recalcular valor da fatura:', error);
      alert('Erro ao recalcular valor da fatura');
    }
  };

  const statusInfo = {
    Paga: { text: 'bg-green-100 text-green-800', icon: FileCheck2 },
    Aberta: { text: 'bg-blue-100 text-blue-800', icon: Calendar },
    Atrasada: { text: 'bg-red-100 text-red-800', icon: Calendar },
    'Parcialmente Paga': { text: 'bg-yellow-100 text-yellow-800', icon: Calendar },
  };
  const StatusIcon = statusInfo[fatura.status].icon;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/clientes/${clienteId}/faturas`} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2"><ArrowLeft className="w-4 h-4 mr-2" />Voltar para Faturas</Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900">{fatura.competencia}</h2>
            <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${statusInfo[fatura.status].text}`}><StatusIcon className="w-4 h-4 mr-2" />{fatura.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center"><Printer className="w-4 h-4 mr-2" /> Imprimir</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"><Download className="w-4 h-4 mr-2" /> Baixar PDF</button>
          </div>
        </div>
      </div>

      {/* Alerta de Discrepância */}
      {diferencaValores && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Discrepância nos Valores Detectada
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                 <p>O valor total da fatura (R$ {fatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) não confere com a soma dos lançamentos (R$ {totalLancamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Diferença: R$ {Math.abs(fatura.valor_total - totalLancamentos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 <div className="mt-3">
                   <button
                     onClick={recalcularValorFatura}
                     className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                   >
                     Corrigir Valor da Fatura
                   </button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex justify-between items-start pb-6 border-b border-gray-200">
          <div><h3 className="text-xl font-semibold text-gray-900">{cliente.nome}</h3><p className="text-sm text-gray-500">Fatura do Cartão Private Label</p></div>
          <div className="text-right"><p className="text-sm text-gray-500">Vencimento</p><p className="text-lg font-bold text-red-600">{new Date(fatura.data_vencimento).toLocaleDateString('pt-BR')}</p></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-b border-gray-200">
          <div><p className="text-sm text-gray-500">Valor Total</p><p className="text-xl font-bold text-blue-600">R$ {fatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div><p className="text-sm text-gray-500">Valor Pago</p><p className="text-xl font-bold text-green-600">R$ {(fatura.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div><p className="text-sm text-gray-500">Saldo Restante</p><p className="text-xl font-bold text-orange-600">R$ {((fatura.valor_total || 0) - (fatura.valor_pago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div><p className="text-sm text-gray-500">Pagamento Mínimo</p><p className="text-xl font-bold text-gray-800">R$ {fatura.pagamento_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 border-b border-gray-200">
          <div><p className="text-sm text-gray-500">Data de Fechamento</p><p className="text-lg font-bold text-gray-800">{new Date(fatura.data_fechamento).toLocaleDateString('pt-BR')}</p></div>
        </div>
        
        <div className="py-6 text-center border-b border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Linha digitável para pagamento</p>
          <div className="flex items-center justify-center"><Barcode className="w-10 h-10 mr-4 text-gray-700" /><p className="font-mono text-lg tracking-widest text-gray-800">{fatura.linha_digitavel || '12345.67890 12345.678901 12345.678902 1 12345678901234'}</p></div>
        </div>

        <div className="pt-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Lançamentos da Fatura</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th><th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor (R$)</th></tr></thead>
              <tbody>
                {transacoes.map((transacao) => (
                  <tr key={transacao.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{transacao.descricao}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-gray-800">{transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-gray-300"><td colSpan={2} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total dos Lançamentos</td><td className="px-4 py-3 text-right text-lg font-bold text-green-600 font-mono">R$ {transacoes.reduce((sum, t) => sum + t.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr><tr className="border-t border-gray-200"><td colSpan={2} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Valor Total da Fatura</td><td className="px-4 py-3 text-right text-lg font-bold text-blue-600 font-mono">R$ {fatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaturaDetalhes;
