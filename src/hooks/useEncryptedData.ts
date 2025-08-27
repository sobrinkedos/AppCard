import { useState, useCallback } from 'react';
import { encryptedDataService } from '../lib/database/encryptedDataService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para operações de banco de dados com criptografia automática
 */
export function useEncryptedData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Insere dados com criptografia automática
   */
  const insertData = useCallback(async <T extends Record<string, any>>(
    table: string,
    data: T,
    options: {
      select?: string;
      auditContext?: string;
    } = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await encryptedDataService.insert(table, data, {
        ...options,
        userId: user?.id
      });

      if (result.error) {
        setError(result.error.message || 'Erro ao inserir dados');
        return { data: null, error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro inesperado ao inserir dados';
      setError(errorMessage);
      return { data: null, error: { message: errorMessage } };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Atualiza dados com criptografia automática
   */
  const updateData = useCallback(async <T extends Record<string, any>>(
    table: string,
    data: Partial<T>,
    filter: Record<string, any>,
    options: {
      select?: string;
      auditContext?: string;
      originalData?: T;
    } = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await encryptedDataService.update(table, data, filter, {
        ...options,
        userId: user?.id
      });

      if (result.error) {
        setError(result.error.message || 'Erro ao atualizar dados');
        return { data: null, error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro inesperado ao atualizar dados';
      setError(errorMessage);
      return { data: null, error: { message: errorMessage } };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Busca dados com descriptografia automática
   */
  const selectData = useCallback(async <T extends Record<string, any>>(
    table: string,
    options: {
      select?: string;
      filter?: Record<string, any>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      auditContext?: string;
      userHasPermission?: boolean;
    } = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await encryptedDataService.select<T>(table, {
        ...options,
        userId: user?.id
      });

      if (result.error) {
        setError(result.error.message || 'Erro ao buscar dados');
        return { data: null, error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro inesperado ao buscar dados';
      setError(errorMessage);
      return { data: null, error: { message: errorMessage } };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Busca um único registro com descriptografia automática
   */
  const selectSingleData = useCallback(async <T extends Record<string, any>>(
    table: string,
    filter: Record<string, any>,
    options: {
      select?: string;
      auditContext?: string;
      userHasPermission?: boolean;
    } = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await encryptedDataService.selectSingle<T>(table, filter, {
        ...options,
        userId: user?.id
      });

      if (result.error) {
        setError(result.error.message || 'Erro ao buscar dados');
        return { data: null, error: result.error };
      }

      return { data: result.data, error: null };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro inesperado ao buscar dados';
      setError(errorMessage);
      return { data: null, error: { message: errorMessage } };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Limpa o estado de erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    insertData,
    updateData,
    selectData,
    selectSingleData,
    loading,
    error,
    clearError
  };
}

/**
 * Hook específico para operações com clientes
 */
export function useEncryptedClientes() {
  const encryptedData = useEncryptedData();

  const createCliente = useCallback(async (clienteData: any) => {
    return encryptedData.insertData('clientes', clienteData, {
      select: '*',
      auditContext: `Novo cliente ${clienteData.nome} cadastrado`
    });
  }, [encryptedData]);

  const updateCliente = useCallback(async (id: string, clienteData: any, originalData?: any) => {
    return encryptedData.updateData('clientes', clienteData, { id }, {
      select: '*',
      auditContext: `Cliente ${clienteData.nome || 'ID: ' + id} atualizado`,
      originalData
    });
  }, [encryptedData]);

  const getClientes = useCallback(async (userHasPermission: boolean = false) => {
    return encryptedData.selectData('clientes', {
      order: { column: 'nome', ascending: true },
      auditContext: 'Consulta lista de clientes',
      userHasPermission
    });
  }, [encryptedData]);

  const getCliente = useCallback(async (id: string, userHasPermission: boolean = false) => {
    return encryptedData.selectSingleData('clientes', { id }, {
      auditContext: `Consulta detalhes do cliente ID: ${id}`,
      userHasPermission
    });
  }, [encryptedData]);

  return {
    createCliente,
    updateCliente,
    getClientes,
    getCliente,
    loading: encryptedData.loading,
    error: encryptedData.error,
    clearError: encryptedData.clearError
  };
}

/**
 * Hook específico para operações com cartões
 */
export function useEncryptedCartoes() {
  const encryptedData = useEncryptedData();

  const createCartao = useCallback(async (cartaoData: any) => {
    return encryptedData.insertData('cartoes', cartaoData, {
      select: '*',
      auditContext: `Novo cartão emitido para cliente ${cartaoData.cliente_id}`
    });
  }, [encryptedData]);

  const updateCartao = useCallback(async (id: string, cartaoData: any, originalData?: any) => {
    return encryptedData.updateData('cartoes', cartaoData, { id }, {
      select: '*',
      auditContext: `Cartão ID: ${id} atualizado`,
      originalData
    });
  }, [encryptedData]);

  const getCartoes = useCallback(async (clienteId?: string, userHasPermission: boolean = false) => {
    const filter = clienteId ? { cliente_id: clienteId } : undefined;
    return encryptedData.selectData('cartoes', {
      filter,
      order: { column: 'data_emissao', ascending: false },
      auditContext: clienteId ? `Consulta cartões do cliente ${clienteId}` : 'Consulta lista de cartões',
      userHasPermission
    });
  }, [encryptedData]);

  const getCartao = useCallback(async (id: string, userHasPermission: boolean = false) => {
    return encryptedData.selectSingleData('cartoes', { id }, {
      auditContext: `Consulta detalhes do cartão ID: ${id}`,
      userHasPermission
    });
  }, [encryptedData]);

  return {
    createCartao,
    updateCartao,
    getCartoes,
    getCartao,
    loading: encryptedData.loading,
    error: encryptedData.error,
    clearError: encryptedData.clearError
  };
}