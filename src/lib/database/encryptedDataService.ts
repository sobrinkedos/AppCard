import { supabase } from '../supabaseClient';
import { dataProtectionService } from '../encryption/dataProtection';
import { encryptionService } from '../encryption/encryptionService';
import { auditLogger } from '../audit/auditLogger';

/**
 * Serviço para operações de banco de dados com criptografia automática
 * Intercepta operações CRUD para criptografar/descriptografar dados sensíveis
 */
export class EncryptedDataService {
  private static instance: EncryptedDataService;

  // Configuração de campos sensíveis por tabela
  private sensitiveFieldsConfig = {
    clientes: [
      { field: 'cpf', type: 'cpf' as const },
      { field: 'telefone', type: 'phone' as const },
      { field: 'endereco', type: 'generic' as const }
    ],
    cartoes: [
      { field: 'numero', type: 'card' as const },
      { field: 'cvv', type: 'cvv' as const }
    ],
    transacoes: [
      { field: 'dados_pagamento', type: 'generic' as const }
    ]
  };

  private constructor() {}

  public static getInstance(): EncryptedDataService {
    if (!EncryptedDataService.instance) {
      EncryptedDataService.instance = new EncryptedDataService();
    }
    return EncryptedDataService.instance;
  }

  /**
   * Insere dados com criptografia automática
   */
  async insert<T extends Record<string, any>>(
    table: string,
    data: T,
    options: {
      select?: string;
      userId?: string;
      auditContext?: string;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    try {
      // Criptografar campos sensíveis
      const encryptedData = this.encryptSensitiveFields(table, data);

      // Log de auditoria antes da inserção
      if (options.userId) {
        await auditLogger.logCreate(
          table,
          'pending',
          options.auditContext || `Inserção na tabela ${table}`,
          data,
          'MEDIUM'
        );
      }

      // Executar inserção
      const query = supabase!.from(table).insert([encryptedData]);
      
      if (options.select) {
        query.select(options.select);
      }

      const { data: result, error } = await query.single();

      if (error) {
        // Log de erro
        if (options.userId) {
          await auditLogger.logError(
            'CREATE',
            table,
            `Erro na inserção: ${error.message}`,
            new Error(error.message)
          );
        }
        return { data: null, error };
      }

      // Descriptografar dados de retorno se necessário
      const decryptedResult = result ? this.decryptSensitiveFields(table, result, true) : null;

      // Log de sucesso
      if (options.userId && result) {
        await auditLogger.logCreate(
          table,
          result.id || 'unknown',
          options.auditContext || `Inserção realizada com sucesso na tabela ${table}`,
          data,
          'MEDIUM'
        );
      }

      return { data: decryptedResult as T, error: null };
    } catch (error: any) {
      console.error(`Erro na inserção criptografada (${table}):`, error);
      return { data: null, error };
    }
  }

  /**
   * Atualiza dados com criptografia automática
   */
  async update<T extends Record<string, any>>(
    table: string,
    data: Partial<T>,
    filter: Record<string, any>,
    options: {
      select?: string;
      userId?: string;
      auditContext?: string;
      originalData?: T;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    try {
      // Criptografar campos sensíveis
      const encryptedData = this.encryptSensitiveFields(table, data);

      // Log de auditoria antes da atualização
      if (options.userId) {
        await auditLogger.logUpdate(
          table,
          Object.values(filter)[0] || 'unknown',
          options.auditContext || `Atualização na tabela ${table}`,
          options.originalData || {},
          data,
          'MEDIUM'
        );
      }

      // Construir query de atualização
      let query = supabase!.from(table).update(encryptedData);

      // Aplicar filtros
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      if (options.select) {
        query = query.select(options.select);
      }

      const { data: result, error } = await query.single();

      if (error) {
        // Log de erro
        if (options.userId) {
          await auditLogger.logError(
            'UPDATE',
            table,
            `Erro na atualização: ${error.message}`,
            new Error(error.message)
          );
        }
        return { data: null, error };
      }

      // Descriptografar dados de retorno se necessário
      const decryptedResult = result ? this.decryptSensitiveFields(table, result, true) : null;

      return { data: decryptedResult as T, error: null };
    } catch (error: any) {
      console.error(`Erro na atualização criptografada (${table}):`, error);
      return { data: null, error };
    }
  }

  /**
   * Busca dados com descriptografia automática
   */
  async select<T extends Record<string, any>>(
    table: string,
    options: {
      select?: string;
      filter?: Record<string, any>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      userId?: string;
      auditContext?: string;
      userHasPermission?: boolean;
    } = {}
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      // Log de auditoria para leitura
      if (options.userId) {
        await auditLogger.logRead(
          table,
          'list',
          options.auditContext || `Consulta na tabela ${table}`
        );
      }

      // Construir query
      let query = supabase!.from(table);

      if (options.select) {
        query = query.select(options.select);
      } else {
        query = query.select('*');
      }

      // Aplicar filtros
      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        });
      }

      // Aplicar ordenação
      if (options.order) {
        query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
      }

      // Aplicar limite
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data: result, error } = await query;

      if (error) {
        // Log de erro
        if (options.userId) {
          await auditLogger.logError(
            'READ',
            table,
            `Erro na consulta: ${error.message}`,
            new Error(error.message)
          );
        }
        return { data: null, error };
      }

      // Descriptografar dados se necessário
      const decryptedResult = result 
        ? result.map(item => this.decryptSensitiveFields(table, item, options.userHasPermission ?? false))
        : null;

      return { data: decryptedResult as T[], error: null };
    } catch (error: any) {
      console.error(`Erro na consulta criptografada (${table}):`, error);
      return { data: null, error };
    }
  }

  /**
   * Busca um único registro com descriptografia automática
   */
  async selectSingle<T extends Record<string, any>>(
    table: string,
    filter: Record<string, any>,
    options: {
      select?: string;
      userId?: string;
      auditContext?: string;
      userHasPermission?: boolean;
    } = {}
  ): Promise<{ data: T | null; error: any }> {
    try {
      // Log de auditoria para leitura
      if (options.userId) {
        await auditLogger.logRead(
          table,
          Object.values(filter)[0] || 'unknown',
          options.auditContext || `Consulta de registro único na tabela ${table}`
        );
      }

      // Construir query
      let query = supabase!.from(table);

      if (options.select) {
        query = query.select(options.select);
      } else {
        query = query.select('*');
      }

      // Aplicar filtros
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.single();

      if (error) {
        // Log de erro
        if (options.userId) {
          await auditLogger.logError(
            'READ',
            table,
            `Erro na consulta: ${error.message}`,
            new Error(error.message)
          );
        }
        return { data: null, error };
      }

      // Descriptografar dados se necessário
      const decryptedResult = result 
        ? this.decryptSensitiveFields(table, result, options.userHasPermission ?? false)
        : null;

      return { data: decryptedResult as T, error: null };
    } catch (error: any) {
      console.error(`Erro na consulta criptografada (${table}):`, error);
      return { data: null, error };
    }
  }

  /**
   * Criptografa campos sensíveis de acordo com a configuração da tabela
   */
  private encryptSensitiveFields(table: string, data: Record<string, any>): Record<string, any> {
    const config = this.sensitiveFieldsConfig[table as keyof typeof this.sensitiveFieldsConfig];
    if (!config) {
      return data;
    }

    return dataProtectionService.protectSensitiveFields(data, config);
  }

  /**
   * Descriptografa campos sensíveis de acordo com a configuração da tabela
   */
  private decryptSensitiveFields(
    table: string, 
    data: Record<string, any>, 
    userHasPermission: boolean
  ): Record<string, any> {
    const config = this.sensitiveFieldsConfig[table as keyof typeof this.sensitiveFieldsConfig];
    if (!config) {
      return data;
    }

    const fieldsToDecrypt = config.map(c => c.field);
    return dataProtectionService.unprotectSensitiveFields(data, fieldsToDecrypt, userHasPermission);
  }

  /**
   * Atualiza a configuração de campos sensíveis para uma tabela
   */
  public updateSensitiveFieldsConfig(
    table: string, 
    config: Array<{ field: string; type: 'cpf' | 'cnpj' | 'phone' | 'email' | 'card' | 'cvv' | 'generic' }>
  ): void {
    this.sensitiveFieldsConfig[table as keyof typeof this.sensitiveFieldsConfig] = config;
  }

  /**
   * Obtém a configuração atual de campos sensíveis
   */
  public getSensitiveFieldsConfig(): typeof this.sensitiveFieldsConfig {
    return { ...this.sensitiveFieldsConfig };
  }

  /**
   * Migra dados existentes para o formato criptografado
   * ATENÇÃO: Use com cuidado em produção
   */
  async migrateExistingData(
    table: string,
    options: {
      batchSize?: number;
      dryRun?: boolean;
      userId?: string;
    } = {}
  ): Promise<{ migrated: number; errors: any[] }> {
    const { batchSize = 100, dryRun = false, userId } = options;
    const config = this.sensitiveFieldsConfig[table as keyof typeof this.sensitiveFieldsConfig];
    
    if (!config) {
      throw new Error(`Configuração de campos sensíveis não encontrada para a tabela ${table}`);
    }

    let migrated = 0;
    const errors: any[] = [];
    let offset = 0;

    console.log(`${dryRun ? '[DRY RUN] ' : ''}Iniciando migração de dados para ${table}...`);

    try {
      while (true) {
        // Buscar lote de dados
        const { data: batch, error } = await supabase!
          .from(table)
          .select('*')
          .range(offset, offset + batchSize - 1);

        if (error) {
          errors.push({ offset, error: error.message });
          break;
        }

        if (!batch || batch.length === 0) {
          break; // Fim dos dados
        }

        // Processar cada registro do lote
        for (const record of batch) {
          try {
            // Verificar se já está criptografado
            const needsEncryption = config.some(({ field }) => {
              const fieldValue = record[field];
              return fieldValue && 
                     typeof fieldValue === 'string' && 
                     !encryptionService.isEncrypted(fieldValue);
            });

            if (needsEncryption && !dryRun) {
              // Criptografar e atualizar
              const encryptedData = this.encryptSensitiveFields(table, record);
              
              const { error: updateError } = await supabase!
                .from(table)
                .update(encryptedData)
                .eq('id', record.id);

              if (updateError) {
                errors.push({ id: record.id, error: updateError.message });
              } else {
                migrated++;
              }
            } else if (needsEncryption && dryRun) {
              migrated++; // Contabilizar para dry run
            }
          } catch (recordError) {
            errors.push({ id: record.id, error: recordError });
          }
        }

        offset += batchSize;
        console.log(`${dryRun ? '[DRY RUN] ' : ''}Processados ${offset} registros...`);
      }

      // Log de auditoria da migração
      if (userId) {
        await auditLogger.logUpdate(
          table,
          'migration',
          `${dryRun ? '[DRY RUN] ' : ''}Migração de criptografia: ${migrated} registros processados`,
          {},
          { migrated, errors: errors.length },
          'HIGH'
        );
      }

      console.log(`${dryRun ? '[DRY RUN] ' : ''}Migração concluída: ${migrated} registros processados, ${errors.length} erros`);
      
      return { migrated, errors };
    } catch (error: any) {
      console.error('Erro durante migração:', error);
      throw error;
    }
  }
}

// Instância singleton
export const encryptedDataService = EncryptedDataService.getInstance();