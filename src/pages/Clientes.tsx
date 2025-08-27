import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseError } from '../lib/supabaseClient';
import SupabaseError from '../components/SupabaseError';
import ClienteFormModal from '../components/ClienteFormModal';
import { auditLogger } from '../lib/audit/auditLogger';

import { MaskedCPF, MaskedPhone, MaskedEmail } from '../components/MaskedData';
import { useAuth } from '../contexts/AuthContext';
import { Cliente } from '../types';

const Clientes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  



  useEffect(() => {
    if (supabaseError) {
      // Dados de demonstração quando Supabase não está disponível
      setClientes([
        {
          id: '1',
          nome: 'Maria Silva',
          cpf: '12345678901',
          email: 'maria@email.com',
          telefone: '11999999999',
          endereco: 'Rua das Flores, 123',
          limite_credito: 5000,
          dia_vencimento: 10,
          status: 'Ativo' as const,
          data_cadastro: '15/08/2024'
        },
        {
          id: '2',
          nome: 'João Santos',
          cpf: '98765432100',
          email: 'joao@email.com',
          telefone: '11888888888',
          endereco: 'Av. Principal, 456',
          limite_credito: 3000,
          dia_vencimento: 5,
          status: 'Ativo' as const,
          data_cadastro: '20/08/2024'
        },
        {
          id: '3',
          nome: 'Ana Costa',
          cpf: '11122233344',
          email: 'ana@email.com',
          telefone: '11777777777',
          endereco: 'Rua do Comércio, 789',
          limite_credito: 8000,
          dia_vencimento: 15,
          status: 'Inativo' as const,
          data_cadastro: '25/08/2024'
        }
      ]);
      setLoadingClientes(false);
      return;
    }

    const fetchClientes = async () => {
      setLoadingClientes(true);
      
      try {
        if (!supabase) {
          setLoadingClientes(false);
          return;
        }

        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('data_cadastro', { ascending: false });
        
        if (error) {
          console.error('Erro ao buscar clientes:', error);
        } else if (data) {
          setClientes(data.map(c => ({
            ...c, 
            data_cadastro: new Date(c.data_cadastro).toLocaleDateString('pt-BR')
          })));
        }
      } catch (error: any) {
        console.error('Erro inesperado:', error);
      } finally {
        setLoadingClientes(false);
      }
    };

    fetchClientes();
  }, []); // Removendo as dependências que causavam loop infinito

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cpf.includes(searchTerm) ||
    (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleNewClient = () => {
    setEditingClient(null);
    setShowModal(true);
  };

  const handleEditClient = (cliente: Cliente) => {
    setEditingClient(cliente);
    setShowModal(true);
  };

  const handleSubmitWithValidation = async (validatedData: any) => {
    try {
      if (supabaseError) {
        // Modo demo - simular salvamento
        const novoCliente = {
          id: Date.now().toString(),
          ...validatedData,
          data_cadastro: new Date().toLocaleDateString('pt-BR')
        };

        if (editingClient) {
          setClientes(prev => prev.map(c => 
            c.id === editingClient.id ? { ...novoCliente, id: editingClient.id } : c
          ));
        } else {
          setClientes(prev => [...prev, novoCliente]);
        }

        setShowModal(false);
        setEditingClient(null);
        return;
      }

      if (!supabase || !user) {
        alert('Sistema não configurado ou usuário não autenticado');
        return;
      }

      const clienteData = {
        ...validatedData,
        lojista_id: user.id
      };

      if (editingClient) {
        // Atualizar cliente existente
        const { error } = await supabase
          .from('clientes')
          .update(clienteData)
          .eq('id', editingClient.id);

        if (error) {
          console.error('Erro ao atualizar cliente:', error);
          alert('Erro ao atualizar cliente: ' + error.message);
          return;
        }

        setClientes(prev => prev.map(c => 
          c.id === editingClient.id 
            ? { ...c, ...validatedData, data_cadastro: c.data_cadastro }
            : c
        ));
      } else {
        // Criar novo cliente
        const { data, error } = await supabase
          .from('clientes')
          .insert([clienteData])
          .select()
          .single();

        if (error) {
          console.error('Erro ao criar cliente:', error);
          alert('Erro ao criar cliente: ' + error.message);
          return;
        }

        const novoCliente = {
          ...data,
          data_cadastro: new Date(data.data_cadastro).toLocaleDateString('pt-BR')
        };
        setClientes(prev => [...prev, novoCliente]);
      }

      setShowModal(false);
      setEditingClient(null);
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      alert('Erro inesperado ao salvar cliente');
    }
  };





  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  return (
    <div className="space-y-6">
      {supabaseError && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Modo Demonstração</h3>
              <p className="text-sm text-blue-600">Você está visualizando dados de exemplo. Conecte seu projeto Supabase para gerenciar clientes reais.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Clientes</h2>
          <p className="text-gray-600 mt-2">Gerencie seus clientes e seus dados</p>
        </div>
        <button
          onClick={handleNewClient}
          className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limite</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingClientes ? (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-600" />
                      Carregando clientes...
                    </div>
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr 
                    key={cliente.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={async () => {
                      await auditLogger.logRead('cliente', cliente.id, `Visualização dos detalhes do cliente ${cliente.nome}`);
                      navigate(`/clientes/${cliente.id}`);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cliente.nome}</div>
                        <div className="text-sm text-gray-500">Cadastro: {cliente.data_cadastro}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {supabaseError ? cliente.cpf : (
                        <MaskedCPF 
                          data={cliente.cpf} 
                          canReveal={true}
                          userId={user?.id}
                          recordId={cliente.id}
                          showCopyButton={true}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {supabaseError ? cliente.email : (
                          <MaskedEmail 
                            data={cliente.email} 
                            canReveal={true}
                            userId={user?.id}
                            recordId={cliente.id}
                            showCopyButton={true}
                          />
                        )}
                      </div>
                      {cliente.telefone && (
                        <div className="text-sm text-gray-500">
                          {supabaseError ? cliente.telefone : (
                            <MaskedPhone 
                              data={cliente.telefone} 
                              canReveal={true}
                              userId={user?.id}
                              recordId={cliente.id}
                              showCopyButton={true}
                            />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {cliente.limite_credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        cliente.status === 'Ativo' ? 'bg-green-100 text-green-800' :
                        cliente.status === 'Inativo' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {cliente.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button 
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            await auditLogger.logRead('cliente', cliente.id, `Iniciada edição do cliente ${cliente.nome}`, 'LOW');
                            handleEditClient(cliente); 
                          }}
                          className="text-yellow-600 hover:text-yellow-800 p-1 rounded-md"
                        ><Edit2 className="w-4 h-4" /></button>
                        <button 
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            await auditLogger.logRead('cliente', cliente.id, `Tentativa de exclusão do cliente ${cliente.nome}`, 'HIGH');
                            if (confirm(`Tem certeza que deseja excluir o cliente ${cliente.nome}?`)) {
                              // Implementar exclusão aqui
                              console.log('Excluir cliente:', cliente.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 p-1 rounded-md"
                        ><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClienteFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmitWithValidation}
        editingClient={editingClient}
        loading={loadingClientes}
      />
    </div>
  );
};

export default Clientes;
