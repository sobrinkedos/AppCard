import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Fatura, Cliente } from '../types';
import { ArrowLeft, Download, Eye, Calendar, DollarSign, FileWarning, Loader2, CheckCircle, X } from 'lucide-react';
import SupabaseError from '../components/SupabaseError';
import { useAuth } from '../contexts/AuthContext';

const FaturasPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cliente, setCliente] = useState<Pick<Cliente, 'nome'> | null>(null);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [paymentData, setPaymentData] = useState({
    valor_pago: '',
    forma_pagamento: '',
    data_pagamento: new Date().toISOString().split('T')[0]
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPartialPaymentOptions, setShowPartialPaymentOptions] = useState(false);
  const [partialPaymentAction, setPartialPaymentAction] = useState('manter');

  useEffect(() => {
    if (supabaseError || !id || !user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      const { data: clienteData, error: clienteError } = await supabase!
        .from('clientes')
        .select('nome')
        .eq('id', id)
        .single();
      
      if (clienteError) console.error("Erro ao buscar cliente:", clienteError);
      else setCliente(clienteData);

      const { data: faturasData, error: faturasError } = await supabase!
        .from('faturas')
        .select('*')
        .eq('cliente_id', id)
        .order('data_vencimento', { ascending: true });

      if (faturasError) console.error("Erro ao buscar faturas:", faturasError);
      else setFaturas(faturasData);

      setLoading(false);
    };

    fetchData();
  }, [id, user]);

  const handleMarkAsPaid = (fatura: Fatura) => {
    setSelectedFatura(fatura);
    setPaymentData({
      valor_pago: fatura.valor_total.toString(),
      forma_pagamento: '',
      data_pagamento: new Date().toISOString().split('T')[0]
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFatura || !supabase || !user) {
      alert('Usuário não autenticado. Faça login novamente.');
      return;
    }

    const valorPago = parseFloat(paymentData.valor_pago);
    const valorTotal = selectedFatura.valor_total;
    const valorJaPago = selectedFatura.valor_pago || 0;
    
    // Verificar se é pagamento parcial
    if (valorPago < (valorTotal - valorJaPago) && !showPartialPaymentOptions) {
      setShowPartialPaymentOptions(true);
      return;
    }

    setProcessingPayment(true);
    try {
      // Usar função apropriada baseada no tipo de pagamento
      let data, error;
       
       try {
         // Usar apenas registrar_recebimento para todos os casos
         const result = await supabase.rpc('registrar_recebimento', {
           p_fatura_id: selectedFatura.id,
           p_valor_pago: valorPago,
           p_forma_pagamento: paymentData.forma_pagamento,
           p_data_pagamento: paymentData.data_pagamento
         });
         data = result.data;
         error = result.error;
       } catch (rpcError) {
         console.error('Erro na chamada RPC:', rpcError);
         error = rpcError;
       }

      if (error) {
        console.error('Erro ao registrar recebimento:', error);
        alert('Erro ao registrar recebimento: ' + error.message);
        return;
      }

      if (data && !data.success) {
        alert('Erro: ' + data.error);
        return;
      }

      // Atualizar a lista de faturas
      if (data && data.success) {
        setFaturas(prev => prev.map(f => {
          if (f.id === selectedFatura.id) {
            return { 
              ...f, 
              status: data.status_final as any,
              valor_pago: data.valor_total_pago
            };
          }
          return f;
        }));
        
        // Se uma nova fatura foi criada, recarregar a lista
        if (data.nova_fatura_id && partialPaymentAction === 'proxima_fatura') {
          window.location.reload();
        }
      } else {
        // Fallback para função antiga
        setFaturas(prev => prev.map(f => 
          f.id === selectedFatura.id 
            ? { ...f, status: 'Paga' as any }
            : f
        ));
      }

      setShowPaymentModal(false);
      setSelectedFatura(null);
      setShowPartialPaymentOptions(false);
      setPartialPaymentAction('manter');
      
      let message = 'Recebimento registrado com sucesso!';
      if (data && data.valor_remanescente > 0) {
        if (partialPaymentAction === 'proxima_fatura') {
          message += ` Uma nova fatura foi criada com o valor remanescente de R$ ${data.valor_remanescente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
        } else {
          message += ` Valor remanescente de R$ ${data.valor_remanescente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mantido na fatura atual.`;
        }
      }
      alert(message);
    } catch (error) {
      console.error('Erro ao registrar recebimento:', error);
      alert('Erro ao registrar recebimento');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!cliente) {
    return <div className="text-center p-8">Cliente não encontrado.</div>;
  }

  const totalEmAberto = faturas
    .filter(f => f.status === 'Aberta' || f.status === 'Atrasada')
    .reduce((sum, f) => sum + f.valor_total, 0);

  const proximoVencimento = faturas
    .filter(f => f.status === 'Aberta')
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0]?.data_vencimento;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/clientes/${id}`} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-2"><ArrowLeft className="w-4 h-4 mr-2" />Voltar para Detalhes do Cliente</Link>
        <h2 className="text-3xl font-bold text-gray-900">Faturas de {cliente.nome}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center"><div className="p-3 bg-red-100 rounded-full mr-4"><DollarSign className="w-6 h-6 text-red-600" /></div><div><p className="text-sm font-medium text-gray-600">Total em Aberto</p><p className="text-2xl font-bold text-gray-900 mt-1">R$ {totalEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div></div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center"><div className="p-3 bg-yellow-100 rounded-full mr-4"><Calendar className="w-6 h-6 text-yellow-600" /></div><div><p className="text-sm font-medium text-gray-600">Próximo Vencimento</p><p className="text-2xl font-bold text-gray-900 mt-1">{proximoVencimento ? new Date(proximoVencimento).toLocaleDateString('pt-BR') : 'N/A'}</p></div></div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center"><div className="p-3 bg-blue-100 rounded-full mr-4"><FileWarning className="w-6 h-6 text-blue-600" /></div><div><p className="text-sm font-medium text-gray-600">Faturas Atrasadas</p><p className="text-2xl font-bold text-gray-900 mt-1">{faturas.filter(f => f.status === 'Atrasada').length}</p></div></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Competência</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {faturas.map((fatura) => (
                <tr key={fatura.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{fatura.competencia}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(fatura.data_vencimento).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                    {fatura.status === 'Parcialmente Paga' ? (
                      <span className="text-orange-600">
                        R$ {(fatura.valor_total - (fatura.valor_pago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span className="text-xs text-gray-500 block">
                          (Pago: R$ {(fatura.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {fatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      </span>
                    ) : (
                      `R$ ${fatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ fatura.status === 'Paga' ? 'bg-green-100 text-green-800' : fatura.status === 'Aberta' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800' }`}>{fatura.status}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <button onClick={() => navigate(`/clientes/${id}/faturas/${fatura.id}`)} className="text-blue-600 hover:text-blue-800 flex items-center text-sm"><Eye className="w-4 h-4 mr-1" /> Ver Detalhes</button>
                      <button className="text-gray-600 hover:text-gray-800 flex items-center text-sm"><Download className="w-4 h-4 mr-1" /> Baixar PDF</button>
                      {fatura.status !== 'Paga' && (
                        <button 
                          onClick={() => handleMarkAsPaid(fatura)}
                          className="text-green-600 hover:text-green-800 flex items-center text-sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Marcar como Paga
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedFatura && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Registrar Recebimento
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Fatura: {selectedFatura.competencia}</p>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div className="text-center p-3 bg-white rounded-lg">
                  <p className="text-xs text-gray-600">Valor Total</p>
                  <p className="text-sm font-bold text-gray-900">R$ {selectedFatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-600">Valor Pago</p>
                  <p className="text-sm font-bold text-blue-600">R$ {(selectedFatura.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-gray-600">Valor Restante</p>
                  <p className="text-sm font-bold text-orange-600">R$ {((selectedFatura.valor_total || 0) - (selectedFatura.valor_pago || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Pago *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.valor_pago}
                  onChange={(e) => {
                    setPaymentData(prev => ({ ...prev, valor_pago: e.target.value }));
                    setShowPartialPaymentOptions(false);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {selectedFatura && (
                  <p className="text-sm text-gray-600 mt-1">
                    Valor total: R$ {selectedFatura.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {selectedFatura.valor_pago > 0 && (
                      <span className="block">
                        Já pago: R$ {selectedFatura.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <br />
                        Restante: R$ {(selectedFatura.valor_total - selectedFatura.valor_pago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pagamento *
                </label>
                <select
                  value={paymentData.forma_pagamento}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecione...</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data do Pagamento *
                </label>
                <input
                  type="date"
                  value={paymentData.data_pagamento}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, data_pagamento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {showPartialPaymentOptions && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-3">
                    ⚠️ Pagamento Parcial Detectado
                  </h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    O valor informado é menor que o valor total da fatura. O que deseja fazer com o valor remanescente?
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="partialPaymentAction"
                        value="manter"
                        checked={partialPaymentAction === 'manter'}
                        onChange={(e) => setPartialPaymentAction(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        Manter na mesma fatura (status: Parcialmente Paga)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="partialPaymentAction"
                        value="proxima_fatura"
                        checked={partialPaymentAction === 'proxima_fatura'}
                        onChange={(e) => setPartialPaymentAction(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        Criar nova fatura para o valor remanescente
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  disabled={processingPayment}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  disabled={processingPayment}
                >
                  {processingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    showPartialPaymentOptions ? 'Confirmar Pagamento Parcial' : 'Confirmar Recebimento'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaturasPage;
