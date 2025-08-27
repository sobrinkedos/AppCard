import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, supabaseError } from '../lib/supabaseClient';
import { LogIn, CreditCard } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError(supabaseError || 'Erro de configuração do Supabase');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('Credenciais inválidas. Por favor, tente novamente.');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('Erro ao tentar fazer login. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full mx-auto">
        <div className="flex justify-center mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <span className="ml-3 text-2xl font-semibold text-gray-900">CardSaaS Admin</span>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Acesso ao Painel</h2>
          <p className="text-center text-gray-600 mb-6">Entre com suas credenciais de administrador.</p>
          {supabaseError && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <p className="text-sm">{supabaseError}</p>
            </div>
          )}
          {error && <p className="bg-red-100 text-red-700 p-3 rounded-md text-center mb-4">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                placeholder="admin@suaempresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="text-right">
              <a href="#" className="text-sm text-blue-600 hover:underline">Esqueceu a senha?</a>
            </div>
            <button
              type="submit"
              disabled={loading || !supabase}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center text-lg disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : <><LogIn className="w-5 h-5 mr-2" /> Entrar</>}
            </button>
            
            {supabaseError && (
              <button
                type="button"
                onClick={() => navigate('/?demo=true')}
                className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center text-lg mt-3"
              >
                <CreditCard className="w-5 h-5 mr-2" /> Acessar Modo Demo
              </button>
            )}
          </form>
        </div>
         <p className="text-center text-sm text-gray-500 mt-6">
            É um cliente? <Link to="/portal/login" className="font-medium text-blue-600 hover:text-blue-500">Acesse o portal do cliente</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
