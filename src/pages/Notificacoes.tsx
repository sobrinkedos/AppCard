import React, { useState, useEffect } from 'react';
import { Bell, DollarSign, CreditCard, UserPlus, Check, Trash2, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import SupabaseError from '../components/SupabaseError';
import { Notificacao, NotificationType } from '../types';

const Notificacoes: React.FC = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }

    const fetchNotificacoes = async () => {
      setLoading(true);
      const { data, error } = await supabase!
        .from('notificacoes')
        .select('*')
        .order('data_criacao', { ascending: false });

      if (error) console.error('Erro ao buscar notificações:', error);
      else if (data) setNotificacoes(data);
      setLoading(false);
    };

    fetchNotificacoes();
  }, []);

  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const getIcon = (tipo: NotificationType) => {
    switch (tipo) {
      case 'Cobrança': return <DollarSign className="w-5 h-5 text-white" />;
      case 'Cartão': return <CreditCard className="w-5 h-5 text-white" />;
      case 'Cliente': return <UserPlus className="w-5 h-5 text-white" />;
      default: return <Bell className="w-5 h-5 text-white" />;
    }
  };

  const getIconBgColor = (tipo: NotificationType) => {
    switch (tipo) {
      case 'Cobrança': return 'bg-green-500';
      case 'Cartão': return 'bg-red-500';
      case 'Cliente': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Central de Notificações</h2>
        <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center mt-4 sm:mt-0"><Check className="w-4 h-4 mr-2" /> Marcar todas como lidas</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></li>
          ) : (
            notificacoes.map((notificacao) => (
              <li key={notificacao.id} className={`p-4 flex items-start space-x-4 hover:bg-gray-50 ${!notificacao.lida ? 'bg-blue-50' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${getIconBgColor(notificacao.tipo)}`}>{getIcon(notificacao.tipo)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center"><h4 className="text-sm font-semibold text-gray-900">{notificacao.titulo}</h4><p className="text-xs text-gray-500">{new Date(notificacao.data_criacao).toLocaleString('pt-BR')}</p></div>
                  <p className="text-sm text-gray-600 mt-1">{notificacao.descricao}</p>
                </div>
                <div className="flex items-center space-x-2">{!notificacao.lida && <div className="w-2 h-2 bg-blue-500 rounded-full" title="Não lida"></div>}<button className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default Notificacoes;
