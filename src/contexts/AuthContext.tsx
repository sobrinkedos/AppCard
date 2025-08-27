import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseError } from '../lib/supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => void;
  hasSupabaseError: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        if (!supabase) {
          console.warn('Cliente Supabase não está disponível');
          setLoading(false);
          return;
        }
        
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao obter sessão inicial:', error);
        setLoading(false);
      }
    };

    // Timeout para garantir que a página carregue mesmo se houver problemas
    const timeout = setTimeout(() => {
      console.warn('Timeout na inicialização do auth - carregando página sem autenticação');
      setLoading(false);
    }, 3000);

    getInitialSession().finally(() => {
      clearTimeout(timeout);
    });

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => {
        clearTimeout(timeout);
        authListener?.subscription.unsubscribe();
      };
    }

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const signOut = async () => {
    try {
      if (!supabase) {
        console.warn('Cliente Supabase não está disponível');
        // Limpar estado local mesmo se o Supabase não estiver disponível
        setSession(null);
        setUser(null);
        return;
      }
      
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Limpar estado local mesmo em caso de erro
      setSession(null);
      setUser(null);
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
    hasSupabaseError: !!supabaseError,
  };

  // Render children only when loading is false to avoid UI flicker
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
