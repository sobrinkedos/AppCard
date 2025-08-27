import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PortalLayout: React.FC = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-md w-full">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <Link to="/portal/dashboard" className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">Meu Cartão</span>
          </Link>
          <button onClick={signOut} className="flex items-center text-gray-600 hover:text-red-600">
            <LogOut className="w-5 h-5 mr-2" />
            Sair
          </button>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 lg:p-8">
        <Outlet />
      </main>
      <footer className="text-center py-4 text-sm text-gray-500">
        © 2025 Loja do João. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default PortalLayout;
