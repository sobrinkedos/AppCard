import React, { useState, useEffect } from 'react';
import { Filter, Search, User, Edit, Lock, DollarSign, Loader2 } from 'lucide-react';
import { supabase, supabaseError } from '../lib/supabaseClient';
import SupabaseError from '../components/SupabaseError';
import { LogAuditoria } from '../types';

const Auditoria: React.FC = () => {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (supabaseError) {
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase!
        .from('logs_auditoria')
        .select('*, membros_equipe(nome)')
        .order('data_log', { ascending: false });

      if (error) console.error('Erro ao buscar logs:', error);
      else if (data) setLogs(data as any);
      setLoading(false);
    };

    fetchLogs();
  }, []);
  
  if (supabaseError) {
    return <SupabaseError message={supabaseError} />;
  }

  const getAcaoIcon = (acao: string) => {
    if (acao.includes('Limite')) return <Edit className="w-4 h-4 text-yellow-600" />;
    if (acao.includes('Bloqueio')) return <Lock className="w-4 h-4 text-red-600" />;
    if (acao.includes('Cobrança')) return <DollarSign className="w-4 h-4 text-green-600" />;
    if (acao.includes('Usuário')) return <User className="w-4 h-4 text-blue-600" />;
    return <Edit className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Logs de Auditoria</h2>
        <p className="text-gray-600 mt-2">Acompanhe as ações importantes realizadas no sistema</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Autor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data e Hora</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center">{getAcaoIcon(log.acao)}<span className="ml-2 text-sm font-medium text-gray-900">{log.acao}</span></div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{log.membros_equipe?.nome || 'Sistema'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.detalhes?.info || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-800">{new Date(log.data_log).toLocaleString('pt-BR')}</div><div className="text-xs text-gray-500">IP: {log.ip_address}</div></td>
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

export default Auditoria;
