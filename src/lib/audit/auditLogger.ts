import { supabase, supabaseError } from '../supabaseClient';
import { AuditLogEntry, AuditContext, AuditActionType, AuditSeverity } from './types';

/**
 * Logger de auditoria para capturar e registrar eventos do sistema
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private context: AuditContext = {};
  private batchQueue: AuditLogEntry[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT = 5000; // 5 segundos

  private constructor() {
    this.initializeContext();
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Inicializa o contexto padrão
   */
  private initializeContext(): void {
    this.context = {
      user_agent: navigator.userAgent,
      session_id: this.generateSessionId(),
      ip_address: '127.0.0.1' // Em produção, isso viria do servidor
    };
  }

  /**
   * Gera um ID de sessão único
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Atualiza o contexto de auditoria
   */
  public setContext(context: Partial<AuditContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Obtém o contexto atual
   */
  public getContext(): AuditContext {
    return { ...this.context };
  }

  /**
   * Registra um evento de auditoria
   */
  public async log(entry: Omit<AuditLogEntry, 'timestamp' | 'lojista_id' | 'usuario_id'>): Promise<void> {
    try {
      let user = null;
      
      // Tentar obter usuário apenas se Supabase estiver disponível
      if (supabase && !supabaseError) {
        try {
          const { data } = await supabase.auth.getUser();
          user = data.user;
        } catch (authError) {
          console.warn('Erro ao obter usuário para auditoria:', authError);
        }
      }
      
      const fullEntry: AuditLogEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
        lojista_id: user?.id || 'demo-user',
        usuario_id: user?.id || 'demo-user',
        session_id: this.context.session_id,
        ip_address: this.context.ip_address,
        user_agent: this.context.user_agent,
        request_path: window.location.pathname,
        request_method: 'GET', // Padrão para ações do frontend
        severity: entry.severity || 'LOW',
        status: entry.status || 'SUCCESS'
      };

      // Adicionar à fila de batch
      this.batchQueue.push(fullEntry);

      // Processar batch se atingiu o tamanho máximo
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.processBatch();
      } else {
        // Agendar processamento do batch
        this.scheduleBatchProcessing();
      }
    } catch (error) {
      console.error('Erro ao registrar log de auditoria:', error);
      // Em caso de erro, tentar registrar localmente
      this.logToLocalStorage(entry);
    }
  }

  /**
   * Agenda o processamento do batch
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.BATCH_TIMEOUT);
  }

  /**
   * Processa o batch de logs
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Se há erro no Supabase ou não há cliente, salvar localmente
    if (supabaseError || !supabase) {
      console.warn('Supabase não disponível, salvando logs localmente');
      batch.forEach(entry => this.logToLocalStorage(entry));
      return;
    }

    try {
      // Usar a função do banco para inserir logs
      for (const entry of batch) {
        await supabase.rpc('log_audit_event', {
          p_lojista_id: entry.lojista_id,
          p_usuario_id: entry.usuario_id,
          p_action: entry.action,
          p_resource_type: entry.resource_type,
          p_resource_id: entry.resource_id,
          p_description: entry.description,
          p_old_values: entry.old_values,
          p_new_values: entry.new_values,
          p_severity: entry.severity,
          p_ip_address: entry.ip_address,
          p_user_agent: entry.user_agent,
          p_session_id: entry.session_id,
          p_correlation_id: entry.correlation_id
        });
      }
    } catch (error) {
      console.warn('Função de auditoria não encontrada no Supabase, salvando logs localmente:', error);
      // Salvar localmente se a função não existir
      batch.forEach(entry => this.logToLocalStorage(entry));
    }
  }

  /**
   * Registra no localStorage como fallback
   */
  private logToLocalStorage(entry: Partial<AuditLogEntry>): void {
    try {
      const logs = JSON.parse(localStorage.getItem('audit_logs_fallback') || '[]');
      logs.push({
        ...entry,
        timestamp: new Date().toISOString(),
        fallback: true
      });
      
      // Manter apenas os últimos 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('audit_logs_fallback', JSON.stringify(logs));
    } catch (error) {
      console.error('Erro ao salvar log no localStorage:', error);
    }
  }

  /**
   * Força o processamento de todos os logs pendentes
   */
  public async flush(): Promise<void> {
    await this.processBatch();
  }

  // Métodos de conveniência para diferentes tipos de ação

  /**
   * Registra uma ação de criação
   */
  public async logCreate(
    resourceType: string,
    resourceId: string,
    description: string,
    newValues?: Record<string, any>,
    severity: AuditSeverity = 'LOW'
  ): Promise<void> {
    await this.log({
      action: 'CREATE',
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      new_values: newValues,
      severity
    });
  }

  /**
   * Registra uma ação de leitura
   */
  public async logRead(
    resourceType: string,
    resourceId: string,
    description: string,
    severity: AuditSeverity = 'LOW'
  ): Promise<void> {
    await this.log({
      action: 'READ',
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      severity
    });
  }

  /**
   * Registra uma ação de atualização
   */
  public async logUpdate(
    resourceType: string,
    resourceId: string,
    description: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    severity: AuditSeverity = 'LOW'
  ): Promise<void> {
    await this.log({
      action: 'UPDATE',
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      old_values: oldValues,
      new_values: newValues,
      severity
    });
  }

  /**
   * Registra uma ação de exclusão
   */
  public async logDelete(
    resourceType: string,
    resourceId: string,
    description: string,
    oldValues?: Record<string, any>,
    severity: AuditSeverity = 'MEDIUM'
  ): Promise<void> {
    await this.log({
      action: 'DELETE',
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      old_values: oldValues,
      severity
    });
  }

  /**
   * Registra uma ação de login
   */
  public async logLogin(
    description: string,
    severity: AuditSeverity = 'LOW'
  ): Promise<void> {
    await this.log({
      action: 'LOGIN',
      resource_type: 'auth',
      description,
      severity
    });
  }

  /**
   * Registra uma ação de logout
   */
  public async logLogout(
    description: string,
    severity: AuditSeverity = 'LOW'
  ): Promise<void> {
    await this.log({
      action: 'LOGOUT',
      resource_type: 'auth',
      description,
      severity
    });
  }

  /**
   * Registra uma ação de exportação
   */
  public async logExport(
    resourceType: string,
    description: string,
    metadata?: Record<string, any>,
    severity: AuditSeverity = 'MEDIUM'
  ): Promise<void> {
    await this.log({
      action: 'EXPORT',
      resource_type: resourceType,
      description,
      new_values: metadata,
      severity
    });
  }

  /**
   * Registra uma ação suspeita
   */
  public async logSuspiciousActivity(
    resourceType: string,
    description: string,
    details?: Record<string, any>,
    severity: AuditSeverity = 'HIGH'
  ): Promise<void> {
    await this.log({
      action: 'READ',
      resource_type: resourceType,
      description,
      new_values: details,
      severity,
      is_suspicious: true,
      requires_review: true
    });
  }

  /**
   * Registra um erro
   */
  public async logError(
    action: AuditActionType,
    resourceType: string,
    description: string,
    error: Error,
    severity: AuditSeverity = 'HIGH'
  ): Promise<void> {
    await this.log({
      action,
      resource_type: resourceType,
      description,
      status: 'ERROR',
      severity,
      error_message: error.message,
      stack_trace: error.stack
    });
  }
}

// Instância singleton
export const auditLogger = AuditLogger.getInstance();