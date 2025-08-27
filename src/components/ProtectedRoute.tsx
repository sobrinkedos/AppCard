import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  redirectTo?: string;
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ redirectTo = '/login', children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to={redirectTo} replace />;
};

export default ProtectedRoute;
