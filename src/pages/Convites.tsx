import React, { useState, useEffect } from 'react';
import { Send, Mail, MessageSquare, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import SupabaseError from '../components/SupabaseError';
import { Convite } from '../types';

const Convites: React.FC = () => {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }

    const fetchConvites = async () => {
      setLoading(true);
      const { data, error } = await supabase!
        .from('convites')
        .select('*')
        .order('data_envio', { ascending: false });

      if (error) console.error('Erro ao buscar convites:', error);
      else if (data) setConvites(data);
      setLoading(false);
    };

    fetchConvites();
  }, []);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const getStatusInfo = (status: Convite['status']) => {
    switch (status) {
      case 'Pendente': return { icon: Clock, color: 'text-yellow-600 bg-yellow-100' };
      case 'Aceito': return { icon: CheckCircle, color: 'text-green-600 bg-green-100' };
      case 'Expirado': return { icon: XCircle, color: 'text-red-600 bg-red-100' };
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Convites para Clientes</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Enviar Novo Convite</h3>
          <form className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700">Enviar para (Email ou WhatsApp)</label><input type="text" placeholder="email@exemplo.com ou (11) 99999-9999" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" /></div>
            <div><label className="block text-sm font-medium text-gray-700">Limite de Crédito Inicial</label><input type="number" placeholder="1000.00" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" /></div>
            <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"><Send className="w-5 h-5 mr-2" /> Enviar Convite</button>
          </form>
        </div>
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900">Histórico de Convites</h3></div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destinatário</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Envio</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th></tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
                ) : (
                  convites.map((convite) => {
                    const statusInfo = getStatusInfo(convite.status);
                    const Icon = statusInfo.icon;
                    return (
                      <tr key={convite.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center">{convite.tipo === 'Email' ? <Mail className="w-5 h-5 text-gray-400 mr-3" /> : <MessageSquare className="w-5 h-5 text-gray-400 mr-3" />}<div><div className="text-sm font-medium text-gray-900">{convite.destinatario}</div><div className="text-sm text-gray-500">{convite.tipo}</div></div></div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(convite.data_envio).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}><Icon className="w-3 h-3 mr-1" />{convite.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Convites;
