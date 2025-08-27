import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  CreditCard, 
  ShoppingCart,
  Receipt, 
  DollarSign, 
  FileText, 
  Settings,
  X,
  Users2,
  MailPlus,
  History,
  Bell,
  LifeBuoy,
  Shield
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const menuItems = [
  { path: '/', icon: BarChart3, label: 'Dashboard' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/cartoes', icon: CreditCard, label: 'Cartões' },
  { path: '/vendas', icon: ShoppingCart, label: 'Vendas' },
  { path: '/transacoes', icon: Receipt, label: 'Transações' },
  { path: '/cobrancas', icon: DollarSign, label: 'Cobranças' },
  { path: '/recebimentos', icon: Receipt, label: 'Recebimentos' },
  { path: '/relatorios', icon: FileText, label: 'Relatórios' },
  { type: 'divider' },
  { path: '/equipe', icon: Users2, label: 'Equipe' },
  { path: '/convites', icon: MailPlus, label: 'Convites' },
  { path: '/notificacoes', icon: Bell, label: 'Notificações' },
  { type: 'divider' },
  { path: '/auditoria', icon: History, label: 'Auditoria' },
  { path: '/suporte', icon: LifeBuoy, label: 'Suporte' },
  { path: '/security-demo', icon: Shield, label: 'Demo Segurança' },
  { path: '/configuracoes', icon: Settings, label: 'Configurações' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">CardSaaS</span>
          </div>
          
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-4">
          {menuItems.map((item, index) => {
            if (item.type === 'divider') {
              return <hr key={index} className="my-3 border-gray-200" />;
            }
            
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path!}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center px-4 py-3 mt-1 text-sm font-medium rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
