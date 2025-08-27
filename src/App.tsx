import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteDetalhes from './pages/ClienteDetalhes';
import Faturas from './pages/Faturas';
import FaturaDetalhes from './pages/FaturaDetalhes';
import Cartoes from './pages/Cartoes';
import Vendas from './pages/Vendas';
import Transacoes from './pages/Transacoes';
import Cobrancas from './pages/Cobrancas';
import Recebimentos from './pages/Recebimentos';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import Equipe from './pages/Equipe';
import Convites from './pages/Convites';
import Auditoria from './pages/Auditoria';
import Notificacoes from './pages/Notificacoes';
import Suporte from './pages/Suporte';
import SecurityDemo from './pages/SecurityDemo';
import PortalLayout from './pages/portal-cliente/PortalLayout';
import PortalLogin from './pages/portal-cliente/PortalLogin';
import PortalDashboard from './pages/portal-cliente/PortalDashboard';
import PortalHistorico from './pages/portal-cliente/PortalHistorico';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

// Layout for the admin panel
const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-4 lg:p-8 mt-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhes />} />
            <Route path="/clientes/:id/faturas" element={<Faturas />} />
            <Route path="/clientes/:id/faturas/:faturaId" element={<FaturaDetalhes />} />
            <Route path="/cartoes" element={<Cartoes />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/transacoes" element={<Transacoes />} />
            <Route path="/cobrancas" element={<Cobrancas />} />
            <Route path="/recebimentos" element={<Recebimentos />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/convites" element={<Convites />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="/suporte" element={<Suporte />} />
            <Route path="/security-demo" element={<SecurityDemo />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Component to handle demo mode logic
const AppContent = () => {
  const { user, hasSupabaseError } = useAuth();
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === 'true';

  // If Supabase has errors and demo mode is requested, allow access
  const shouldAllowAccess = user || (hasSupabaseError && isDemoMode);

  return (
    <Routes>
      {/* Public routes that redirect if logged in */}
      <Route path="/login" element={shouldAllowAccess ? <Navigate to="/" /> : <Login />} />
      <Route path="/portal/login" element={shouldAllowAccess ? <Navigate to="/portal/dashboard" /> : <PortalLogin />} />

      {/* Protected Customer Portal Routes */}
      <Route 
        path="/portal/*" 
        element={
          shouldAllowAccess ? (
            <Routes>
              <Route element={<PortalLayout />}>
                <Route path="dashboard" element={<PortalDashboard />} />
                <Route path="historico" element={<PortalHistorico />} />
                <Route path="*" element={<Navigate to="/portal/dashboard" replace />} />
              </Route>
            </Routes>
          ) : (
            <Navigate to="/portal/login" replace />
          )
        }
      />
      
      {/* Protected Admin Routes - Must be last to catch all other paths */}
      <Route 
        path="/*" 
        element={
          shouldAllowAccess ? (
            <AdminLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
