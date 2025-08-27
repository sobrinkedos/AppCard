import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SupabaseErrorProps {
  message: string;
}

const SupabaseError: React.FC<SupabaseErrorProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
      <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
      <h3 className="text-xl font-semibold text-yellow-800 mb-2">Erro de Configuração do Supabase</h3>
      <p className="text-yellow-700 max-w-lg">{message}</p>
      <p className="text-sm text-yellow-600 mt-4">
        Por favor, verifique se você conectou um projeto Supabase e se as variáveis de ambiente <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> estão corretas no arquivo <code>.env</code>.
      </p>
    </div>
  );
};

export default SupabaseError;
