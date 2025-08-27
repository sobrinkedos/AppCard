import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Eye, Edit, Lock, Unlock, X, Loader2, Power, Palette, Edit2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { Cartao, Cliente } from '../types';
import SupabaseError from '../components/SupabaseError';
import { useAuth } from '../contexts/AuthContext';

const Cartoes: React.FC = () => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCartao, setViewingCartao] = useState<Cartao | null>(null);
  const [activeTab, setActiveTab] = useState('lista');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cliente_id: '',
    limite: '',
    design: 'Clássico'
  });

  useEffect(() => {
    if (supabaseError || !user) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: cartoesData, error: cartoesError } = await supabase!
        .from('cartoes')
        .select('*, clientes(nome)')
        .eq('lojista_id', user.id);
      
      const { data: clientesData, error: clientesError } = await supabase!
        .from('clientes')
        .select('*')
        .eq('lojista_id', user.id);

      if (cartoesError) {
        console.error('Erro ao buscar cartões:', cartoesError);
        setError('Erro ao carregar cartões');
      } else if (cartoesData) {
        setCartoes(cartoesData as any);
      }

      if (clientesError) {
        console.error('Erro ao buscar clientes:', clientesError);
        setError('Erro ao carregar clientes');
      } else if (clientesData) {
        setClientes(clientesData);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError('Erro inesperado ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const generateCardNumber = () => {
    const prefix = '4532'; // Visa prefix
    const randomDigits = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
    return prefix + randomDigits;
  };

  const generateCVV = () => {
    return Math.floor(Math.random() * 900 + 100).toString();
  };

  const generateExpiryDate = () => {
    const currentDate = new Date();
    const expiryDate = new Date(currentDate.getFullYear() + 3, currentDate.getMonth());
    const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
    const year = expiryDate.getFullYear().toString().slice(-2);
    return `${month}/${year}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.cliente_id || !formData.limite) return;

    setSaving(true);
    setError(null);

    try {
      const cartaoData = {
        cliente_id: formData.cliente_id,
        lojista_id: user.id,
        numero_cartao: generateCardNumber(),
        cvv: generateCVV(),
        data_validade: generateExpiryDate(),
        limite: parseFloat(formData.limite),
        design: formData.design
      };

      if (editingCartao) {
        const { error } = await supabase!
          .from('cartoes')
          .update({
            limite: parseFloat(formData.limite),
            design: formData.design
          })
          .eq('id', editingCartao.id)
          .eq('lojista_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase!
          .from('cartoes')
          .insert([cartaoData]);

        if (error) throw error;
      }

      await fetchData();
      handleCloseModal();
    } catch (err: any) {
      console.error('Erro ao salvar cartão:', err);
      setError(err.message || 'Erro ao salvar cartão');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cartao: Cartao) => {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const newStatus = cartao.status === 'Ativo' ? 'Bloqueado' : 'Ativo';
      
      const { error } = await supabase!
        .from('cartoes')
        .update({ status: newStatus })
        .eq('id', cartao.id)
        .eq('lojista_id', user.id);

      if (error) throw error;

      await fetchData();
    } catch (err: any) {
      console.error('Erro ao alterar status:', err);
      setError(err.message || 'Erro ao alterar status do cartão');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cartao: Cartao) => {
    setEditingCartao(cartao);
    setFormData({
      cliente_id: cartao.cliente_id,
      limite: cartao.limite.toString(),
      design: cartao.design || 'Clássico'
    });
    setShowModal(true);
  };

  const handleView = (cartao: Cartao) => {
    setViewingCartao(cartao);
    setShowViewModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCartao(null);
    setFormData({
      cliente_id: '',
      limite: '',
      design: 'Clássico'
    });
    setError(null);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingCartao(null);
  };

  const designs = [
    { nome: 'Clássico', cor: 'bg-gradient-to-r from-blue-600 to-blue-800' },
    { nome: 'Premium', cor: 'bg-gradient-to-r from-gray-800 to-black' },
    { nome: 'Personalizado', cor: 'bg-gradient-to-r from-purple-600 to-pink-600' },
  ];

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Cartões</h2>
          <p className="text-gray-600 mt-2">Gerencie os cartões emitidos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cartão
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button onClick={() => setActiveTab('lista')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ activeTab === 'lista' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700' }`}>Lista de Cartões</button>
            <button onClick={() => setActiveTab('designs')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ activeTab === 'designs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700' }`}>Designs Disponíveis</button>
          </nav>
        </div>

        {activeTab === 'lista' ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cartoes.map((cartao) => (
                <div key={cartao.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-4 text-white mb-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white bg-opacity-10 rounded-full -translate-y-10 translate-x-10"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-8">
                        <div className="text-xs font-medium opacity-80">CardSaaS</div>
                        <div className="text-xs opacity-80">{cartao.design || 'Clássico'}</div>
                      </div>
                      <div className="text-lg font-mono tracking-wider mb-4">{cartao.numero_cartao}</div>
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-xs opacity-80">TITULAR</div>
                          <div className="font-medium text-sm">{cartao.clientes?.nome.toUpperCase()}</div>
                        </div>
                        <div className="text-xs opacity-80">{new Date(cartao.data_emissao).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Status</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ cartao.status === 'Ativo' ? 'bg-green-100 text-green-800' : cartao.status === 'Inativo' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800' }`}>{cartao.status}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Limite utilizado</span>
                        <span>R$ {cartao.saldo_utilizado.toFixed(2)} / R$ {cartao.limite.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(cartao.saldo_utilizado / cartao.limite) * 100}%` }}></div>
                      </div>
                    </div>
                    <div className="flex justify-between pt-2">
                      <button 
                        onClick={() => handleView(cartao)}
                        className="flex items-center text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                        disabled={saving}
                      >
                        <Eye className="w-4 h-4 mr-1" />Ver
                      </button>
                      <button 
                        onClick={() => handleEdit(cartao)}
                        className="flex items-center text-yellow-600 hover:text-yellow-800 text-sm disabled:opacity-50"
                        disabled={saving}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />Editar
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(cartao)}
                        className="flex items-center text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                        disabled={saving}
                      >
                        <Power className="w-4 h-4 mr-1" />
                        {cartao.status === 'Ativo' ? 'Bloquear' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {designs.map((design, index) => (
                <div key={index} className="text-center">
                  <div className={`${design.cor} rounded-lg p-6 text-white mb-4 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white bg-opacity-10 rounded-full -translate-y-8 translate-x-8"></div>
                    <div className="relative z-10">
                      <div className="text-xs font-medium opacity-80 mb-8">CardSaaS</div>
                      <div className="text-sm font-mono tracking-wider mb-6">•••• •••• •••• 1234</div>
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-xs opacity-80">TITULAR</div>
                          <div className="font-medium text-xs">NOME DO CLIENTE</div>
                        </div>
                        <div className="text-xs opacity-80">12/28</div>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900">{design.nome}</h3>
                  <button className="mt-2 flex items-center justify-center w-full text-blue-600 hover:text-blue-800 text-sm"><Palette className="w-4 h-4 mr-1" />Personalizar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCartao ? 'Editar Cartão' : 'Novo Cartão'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Cliente</label>
                <select 
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  required
                  disabled={saving || editingCartao !== null}
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Limite de Crédito</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={formData.limite}
                  onChange={(e) => setFormData({...formData, limite: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50" 
                  placeholder="1000.00"
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Design do Cartão</label>
                <select 
                  value={formData.design}
                  onChange={(e) => setFormData({...formData, design: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  disabled={saving}
                >
                  <option value="Clássico">Clássico</option>
                  <option value="Premium">Premium</option>
                  <option value="Personalizado">Personalizado</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  type="button"
                  onClick={handleCloseModal} 
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                  disabled={saving || !formData.cliente_id || !formData.limite}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {saving ? 'Salvando...' : (editingCartao ? 'Atualizar' : 'Emitir Cartão')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização Detalhada */}
      {showViewModal && viewingCartao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Detalhes do Cartão</h3>
              <button
                onClick={handleCloseViewModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Cartão Visual */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm opacity-80">Cartão de Crédito</p>
                    <p className="text-lg font-semibold">{viewingCartao.design}</p>
                  </div>
                  <CreditCard className="w-8 h-8" />
                </div>
                <div className="mb-4">
                  <p className="text-lg font-mono tracking-wider">
                    {viewingCartao.numero_cartao?.replace(/(\d{4})/g, '$1 ').trim() || '•••• •••• •••• ••••'}
                  </p>
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs opacity-80">Válido até</p>
                    <p className="text-sm">{viewingCartao.data_validade}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-80">CVV</p>
                    <p className="text-sm">{viewingCartao.cvv}</p>
                  </div>
                </div>
              </div>

              {/* Informações do Cliente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Cliente</h4>
                <p className="text-gray-700">
                  {clientes.find(c => c.id === viewingCartao.cliente_id)?.nome || 'Cliente não encontrado'}
                </p>
              </div>

              {/* Informações Financeiras */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-1">Limite Total</h4>
                  <p className="text-lg text-green-600 font-semibold">
                    R$ {viewingCartao.limite?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-1">Saldo Utilizado</h4>
                  <p className="text-lg text-red-600 font-semibold">
                    R$ {viewingCartao.saldo_utilizado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Limite Disponível */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Limite Disponível</h4>
                <div className="flex items-center justify-between">
                  <p className="text-lg text-blue-600 font-semibold">
                    R$ {((viewingCartao.limite || 0) - (viewingCartao.saldo_utilizado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="text-sm text-gray-600">
                    {Math.round(((viewingCartao.saldo_utilizado || 0) / (viewingCartao.limite || 1)) * 100)}% utilizado
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(((viewingCartao.saldo_utilizado || 0) / (viewingCartao.limite || 1)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Status e Data de Emissão */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-1">Status</h4>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    viewingCartao.status === 'Ativo' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {viewingCartao.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-1">Data de Emissão</h4>
                  <p className="text-gray-700">
                    {viewingCartao.data_emissao ? new Date(viewingCartao.data_emissao).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleCloseViewModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cartoes;
