import { supabase } from '../supabaseClient';
import { AuditAlert, AuditSeverity } from './types';

/**
 * Sistema de alertas de auditoria em tempo real
 */
export class AuditAlertsService {
  private static instance: AuditAlertsService;
  private alertSubscription: any = null;
  private alertCallbacks: Map<string, (alert: AuditAlert) => void> = new Map();

  // Configurações de alertas
  private alertRules = {
    // Múltiplas tentativas de login falhadas
    FAILED_LOGIN_ATTEMPTS: {
      threshold: 5,
      timeWindow: 15 * 60 * 1000, // 15 minutos
      severity: 'HIGH' as AuditSeverity
    },
    
    // Muitas ações em pouco tempo
    RATE_LIMIT_EXCEEDED: {
      threshold: 20,
      timeWindow: 5 * 60 * 1000, // 5 minutos
      severity: 'MEDIUM' as AuditSeverity
    },
    
    // Acesso a dados sensíveis fora do horário
    OFF_HOURS_ACCESS: {
      startHour: 22, // 22:00
      endHour: 6,    // 06:00
      severity: 'MEDIUM' as AuditSeverity
    },
    
    // Exportação de grandes volumes de dados
    BULK_DATA_EXPORT: {
      threshold: 1000, // registros
      severity: 'HIGH' as AuditSeverity
    },
    
    // Ações administrativas críticas
    CRITICAL_ADMIN_ACTION: {
      actions: ['DELETE', 'SUSPEND', 'ACTIVATE'],
      resources: ['cliente', 'cartao', 'usuario'],
      severity: 'CRITICAL' as AuditSeverity
    },
    
    // Padrões de acesso anômalos
    ANOMALOUS_ACCESS: {
      ipChangeThreshold: 3, // IPs diferentes em pouco tempo
      timeWindow: 30 * 60 * 1000, // 30 minutos
      severity: 'HIGH' as AuditSeverity
    }
  };

  private constructor() {}

  public static getInstance(): AuditAlertsService {
    if (!AuditAlertsService.instance) {
      AuditAlertsService.instance = new AuditAlertsService();
    }
    return AuditAlertsService.instance;
  }

  /**
   * Inicia o monitoramento de alertas em tempo real
   */
  public startRealtimeMonitoring(lojistaId: string): void {
    if (this.alertSubscription) {
      this.stopRealtimeMonitoring();
    }

    // Subscrever a novos logs de auditoria
    this.alertSubscription = supabase
      .channel('audit_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs_auditoria',
          filter: `lojista_id=eq.${lojistaId}`
        },
        (payload) => {
          this.processNewAuditLog(payload.new);
        }
      )
      .subscribe();

    console.log('Monitoramento de alertas iniciado para lojista:', lojistaId);
  }

  /**
   * Para o monitoramento de alertas
   */
  public stopRealtimeMonitoring(): void {
    if (this.alertSubscription) {
      supabase.removeChannel(this.alertSubscription);
      this.alertSubscription = null;
      console.log('Monitoramento de alertas parado');
    }
  }

  /**
   * Registra callback para receber alertas
   */
  public onAlert(id: string, callback: (alert: AuditAlert) => void): void {
    this.alertCallbacks.set(id, callback);
  }

  /**
   * Remove callback de alertas
   */
  public offAlert(id: string): void {
    this.alertCallbacks.delete(id);
  }

  /**
   * Processa novo log de auditoria para detectar alertas
   */
  private async processNewAuditLog(log: any): Promise<void> {
    try {
      const alerts: Partial<AuditAlert>[] = [];

      // Verificar cada regra de alerta
      await Promise.all([
        this.checkFailedLoginAttempts(log, alerts),
        this.checkRateLimitExceeded(log, alerts),
        this.checkOffHoursAccess(log, alerts),
        this.checkBulkDataExport(log, alerts),
        this.checkCriticalAdminAction(log, alerts),
        this.checkAnomalousAccess(log, alerts)
      ]);

      // Criar alertas no banco de dados
      for (const alert of alerts) {
        await this.createAlert(log.id, alert);
      }
    } catch (error) {
      console.error('Erro ao processar log para alertas:', error);
    }
  }

  /**
   * Verifica tentativas de login falhadas
   */
  private async checkFailedLoginAttempts(log: any, alerts: Partial<AuditAlert>[]): Promise<void> {
    if (log.action !== 'LOGIN' || log.status === 'SUCCESS') return;

    const rule = this.alertRules.FAILED_LOGIN_ATTEMPTS;
    const timeThreshold = new Date(Date.now() - rule.timeWindow);

    try {
      const { count } = await supabase
        .from('logs_auditoria')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', log.usuario_id)
        .eq('action', 'LOGIN')
        .neq('status', 'SUCCESS')
        .gte('timestamp', timeThreshold.toISOString());

      if (count && count >= rule.threshold) {
        alerts.push({
          alert_type: 'FAILED_LOGIN_ATTEMPTS',
          title: 'Múltiplas Tentativas de Login Falhadas',
          message: `Usuário ${log.usuario_id} teve ${count} tentativas de login falhadas nos últimos 15 minutos`,
          severity: rule.severity
        });
      }
    } catch (error) {
      console.error('Erro ao verificar tentativas de login:', error);
    }
  }

  /**
   * Verifica excesso de ações em pouco tempo
   */
  private async checkRateLimitExceeded(log: any, alerts: Partial<AuditAlert>[]): Promise<void> {
    const rule = this.alertRules.RATE_LIMIT_EXCEEDED;
    const timeThreshold = new Date(Date.now() - rule.timeWindow);

    try {
      const { count } = await supabase
        .from('logs_auditoria')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', log.usuario_id)
        .gte('timestamp', timeThreshold.toISOString());

      if (count && count >= rule.threshold) {
        alerts.push({
          alert_type: 'RATE_LIMIT_EXCEEDED',
          title: 'Limite de Ações Excedido',
          message: `Usuário ${log.usuario_id} executou ${count} ações nos últimos 5 minutos`,
          severity: rule.severity
        });
      }
    } catch (error) {
      console.error('Erro ao verificar limite de ações:', error);
    }
  }

  /**
   * Verifica acesso fora do horário comercial
   */
  private async checkOffHoursAccess(log: any, alerts: Partial<AuditAlert>[]): Promise<void> {
    const rule = this.alertRules.OFF_HOURS_ACCESS;
    const logTime = new Date(log.timestamp);
    const hour = logTime.getHours();

    // Verificar se está fora do horário (22:00 às 06:00)
    const isOffHours = hour >= rule.startHour || hour < rule.endHour;
    
    // Verificar se é ação sensível
    const isSensitiveAction = ['DECRYPT', 'EXPORT', 'DELETE'].includes(log.action);

    if (isOffHours && isSensitiveAction) {
      alerts.push({
        alert_type: 'OFF_HOURS_ACCESS',
        title: 'Acesso Fora do Horário',
        message: `Ação ${log.action} executada às ${logTime.toLocaleTimeString()} (fora do horário comercial)`,
        severity: rule.severity
      });
    }
  }

  /**
   * Verifica exportação de grandes volumes
   */
  private async checkBulkDataExport(log: any, alerts: Partial<AuditAlert>[]): Promise<void> {
    if (log.action !== 'EXPORT') return;

    const rule = this.alertRules.BULK_DATA_EXPORT;
    
    // Verificar se há informação sobre quantidade de registros
    const recordCount = log.new_values?.record_count || log.new_values?.count;
    
    if (recordCount && recordCount >= rule.threshold) {
      alerts.push({
        alert_type: 'BULK_DATA_EXPORT',
        title: 'Exportação de Grande Volume',
        message: `Exportação de ${recordCount} registros de ${log.resource_type}`,
        severity: rule.severity
      });
    }
  }

  /**
   * Verifica ações administrativas críticas
   */
  private async checkCriticalAdminAction(log: any, alerts: Partial<AuditAlert>[]): Promise<void> {
    const rule = this.alertRules.CRITICAL_ADMIN_ACTION;
    
    if (rule.actions.includes(log.action) && rule.resources.includes(log.resource_type)) {
      alerts.push({
        alert_type: 'CRITICAL_ADMIN_ACTION',
        title: 'Ação Administrativa Crítica',
        message: `Ação ${log.action} executada em ${log.resource_type}: ${log.description}`,
        severity: rule.severity
      });
    }
  }

  /**
   * Verifica padrões de acesso anômalos
   */
  private async checkAnomalousAccess(log: any, alerts: Partial<AuditAlert>[]): Promise<void> {
    if (!log.ip_address || !log.usuario_id) return;

    const rule = this.alertRules.ANOMALOUS_ACCESS;
    const timeThreshold = new Date(Date.now() - rule.timeWindow);

    try {
      // Buscar IPs únicos do usuário no período
      const { data } = await supabase
        .from('logs_auditoria')
        .select('ip_address')
        .eq('usuario_id', log.usuario_id)
        .gte('timestamp', timeThreshold.toISOString())
        .not('ip_address', 'is', null);

      if (data) {
        const uniqueIPs = new Set(data.map(row => row.ip_address));
        
        if (uniqueIPs.size >= rule.ipChangeThreshold) {
          alerts.push({
            alert_type: 'ANOMALOUS_ACCESS',
            title: 'Padrão de Acesso Anômalo',
            message: `Usuário ${log.usuario_id} acessou de ${uniqueIPs.size} IPs diferentes nos últimos 30 minutos`,
            severity: rule.severity
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar acesso anômalo:', error);
    }
  }

  /**
   * Cria um alerta no banco de dados
   */
  private async createAlert(logId: string, alertData: Partial<AuditAlert>): Promise<void> {
    try {
      const alert: Partial<AuditAlert> = {
        log_id: logId,
        ...alertData,
        status: 'OPEN',
        triggered_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('audit_alerts')
        .insert([alert])
        .select()
        .single();

      if (error) throw error;

      // Notificar callbacks registrados
      this.notifyCallbacks(data);
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
    }
  }

  /**
   * Notifica todos os callbacks registrados
   */
  private notifyCallbacks(alert: AuditAlert): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Erro ao executar callback de alerta:', error);
      }
    });
  }

  /**
   * Atualiza configurações de alertas
   */
  public updateAlertRules(newRules: Partial<typeof this.alertRules>): void {
    this.alertRules = { ...this.alertRules, ...newRules };
  }

  /**
   * Obtém configurações atuais de alertas
   */
  public getAlertRules(): typeof this.alertRules {
    return { ...this.alertRules };
  }

  /**
   * Testa um alerta manualmente
   */
  public async testAlert(alertType: string, mockData: any): Promise<void> {
    const alert: Partial<AuditAlert> = {
      alert_type: alertType,
      title: `Teste: ${alertType}`,
      message: `Alerta de teste com dados: ${JSON.stringify(mockData)}`,
      severity: 'LOW',
      status: 'OPEN',
      triggered_at: new Date().toISOString(),
      metadata: { test: true, ...mockData }
    };

    this.notifyCallbacks(alert as AuditAlert);
  }

  /**
   * Obtém estatísticas de alertas
   */
  public async getAlertStatistics(lojistaId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const { data, error } = await supabase
        .from('audit_alerts')
        .select(`
          alert_type,
          severity,
          status,
          triggered_at,
          logs_auditoria!inner(lojista_id)
        `)
        .eq('logs_auditoria.lojista_id', lojistaId)
        .gte('triggered_at', startDate.toISOString());

      if (error) throw error;

      const alerts = data || [];

      return {
        total: alerts.length,
        byType: this.groupBy(alerts, 'alert_type'),
        bySeverity: this.groupBy(alerts, 'severity'),
        byStatus: this.groupBy(alerts, 'status'),
        trend: this.calculateTrend(alerts, days)
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de alertas:', error);
      return null;
    }
  }

  /**
   * Agrupa dados por campo
   */
  private groupBy(array: any[], field: string): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = item[field];
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Calcula tendência de alertas
   */
  private calculateTrend(alerts: any[], days: number): any[] {
    const trend = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayAlerts = alerts.filter(alert => {
        const alertDate = new Date(alert.triggered_at);
        return alertDate >= dayStart && alertDate <= dayEnd;
      });

      trend.push({
        date: dayStart.toISOString().split('T')[0],
        count: dayAlerts.length,
        critical: dayAlerts.filter(a => a.severity === 'CRITICAL').length,
        high: dayAlerts.filter(a => a.severity === 'HIGH').length
      });
    }

    return trend;
  }
}

// Instância singleton
export const auditAlerts = AuditAlertsService.getInstance();