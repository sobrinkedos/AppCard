import { supabase } from '../supabaseClient';
import { AuditFilter, AuditMetrics, AuditAlert } from './types';

/**
 * Serviço para dashboard de auditoria com métricas e análises
 */
export class AuditDashboardService {
  private static instance: AuditDashboardService;

  private constructor() {}

  public static getInstance(): AuditDashboardService {
    if (!AuditDashboardService.instance) {
      AuditDashboardService.instance = new AuditDashboardService();
    }
    return AuditDashboardService.instance;
  }

  /**
   * Obtém métricas de auditoria para o dashboard
   */
  async getAuditMetrics(
    lojistaId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditMetrics | null> {
    try {
      const { data, error } = await supabase
        .from('audit_metrics')
        .select('*')
        .eq('lojista_id', lojistaId)
        .gte('period_start', startDate.toISOString())
        .lte('period_end', endDate.toISOString())
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Erro ao buscar métricas de auditoria:', error);
      return null;
    }
  }

  /**
   * Gera métricas em tempo real
   */
  async generateRealtimeMetrics(
    lojistaId: string,
    hours: number = 24
  ): Promise<AuditMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));

    try {
      const { data, error } = await supabase
        .from('logs_auditoria')
        .select(`
          action,
          severity,
          status,
          is_suspicious,
          duration_ms,
          timestamp
        `)
        .eq('lojista_id', lojistaId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (error) throw error;

      const logs = data || [];

      // Calcular métricas
      const metrics: AuditMetrics = {
        lojista_id: lojistaId,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
        
        // Contadores gerais
        total_events: logs.length,
        success_events: logs.filter(l => l.status === 'SUCCESS').length,
        failure_events: logs.filter(l => l.status === 'FAILURE' || l.status === 'ERROR').length,
        warning_events: logs.filter(l => l.status === 'WARNING').length,
        
        // Por severidade
        low_severity: logs.filter(l => l.severity === 'LOW').length,
        medium_severity: logs.filter(l => l.severity === 'MEDIUM').length,
        high_severity: logs.filter(l => l.severity === 'HIGH').length,
        critical_severity: logs.filter(l => l.severity === 'CRITICAL').length,
        
        // Por tipo de ação
        create_actions: logs.filter(l => l.action === 'CREATE').length,
        read_actions: logs.filter(l => l.action === 'READ').length,
        update_actions: logs.filter(l => l.action === 'UPDATE').length,
        delete_actions: logs.filter(l => l.action === 'DELETE').length,
        
        // Métricas de segurança
        suspicious_events: logs.filter(l => l.is_suspicious).length,
        failed_logins: logs.filter(l => l.action === 'LOGIN' && l.status !== 'SUCCESS').length,
        data_exports: logs.filter(l => l.action === 'EXPORT').length,
        
        // Performance
        avg_response_time_ms: this.calculateAverageResponseTime(logs),
        max_response_time_ms: this.calculateMaxResponseTime(logs)
      };

      return metrics;
    } catch (error) {
      console.error('Erro ao gerar métricas em tempo real:', error);
      throw error;
    }
  }

  /**
   * Obtém logs de auditoria com filtros avançados
   */
  async getAuditLogs(filter: AuditFilter = {}) {
    try {
      let query = supabase
        .from('logs_auditoria')
        .select(`
          *,
          audit_alerts(*)
        `);

      // Aplicar filtros
      if (filter.start_date) {
        query = query.gte('timestamp', filter.start_date);
      }
      if (filter.end_date) {
        query = query.lte('timestamp', filter.end_date);
      }
      if (filter.usuario_id) {
        query = query.eq('usuario_id', filter.usuario_id);
      }
      if (filter.action) {
        query = query.eq('action', filter.action);
      }
      if (filter.resource_type) {
        query = query.eq('resource_type', filter.resource_type);
      }
      if (filter.severity) {
        query = query.eq('severity', filter.severity);
      }
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      if (filter.is_suspicious !== undefined) {
        query = query.eq('is_suspicious', filter.is_suspicious);
      }
      if (filter.search) {
        query = query.or(`description.ilike.%${filter.search}%,resource_type.ilike.%${filter.search}%`);
      }

      // Ordenação e paginação
      query = query.order('timestamp', { ascending: false });
      
      if (filter.limit) {
        query = query.limit(filter.limit);
      }
      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      throw error;
    }
  }

  /**
   * Obtém alertas de auditoria
   */
  async getAuditAlerts(
    lojistaId: string,
    status?: string,
    limit: number = 50
  ): Promise<AuditAlert[]> {
    try {
      let query = supabase
        .from('audit_alerts')
        .select(`
          *,
          logs_auditoria!inner(lojista_id)
        `)
        .eq('logs_auditoria.lojista_id', lojistaId);

      if (status) {
        query = query.eq('status', status);
      }

      query = query
        .order('triggered_at', { ascending: false })
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar alertas de auditoria:', error);
      return [];
    }
  }

  /**
   * Atualiza status de um alerta
   */
  async updateAlertStatus(
    alertId: string,
    status: string,
    assignedTo?: string,
    resolutionNotes?: string
  ): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'INVESTIGATING' && assignedTo) {
        updateData.assigned_to = assignedTo;
        updateData.acknowledged_at = new Date().toISOString();
      }

      if (status === 'RESOLVED' || status === 'FALSE_POSITIVE') {
        updateData.resolved_at = new Date().toISOString();
        if (resolutionNotes) {
          updateData.resolution_notes = resolutionNotes;
        }
      }

      const { error } = await supabase
        .from('audit_alerts')
        .update(updateData)
        .eq('id', alertId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Erro ao atualizar status do alerta:', error);
      return false;
    }
  }

  /**
   * Obtém estatísticas de atividade por usuário
   */
  async getUserActivityStats(
    lojistaId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      const { data, error } = await supabase
        .from('logs_auditoria')
        .select(`
          usuario_id,
          action,
          severity,
          is_suspicious,
          timestamp
        `)
        .eq('lojista_id', lojistaId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('usuario_id', 'is', null);

      if (error) throw error;

      const logs = data || [];
      const userStats = new Map();

      logs.forEach(log => {
        const userId = log.usuario_id;
        if (!userStats.has(userId)) {
          userStats.set(userId, {
            userId,
            totalActions: 0,
            suspiciousActions: 0,
            actionsByType: {},
            actionsBySeverity: {},
            lastActivity: null
          });
        }

        const stats = userStats.get(userId);
        stats.totalActions++;
        
        if (log.is_suspicious) {
          stats.suspiciousActions++;
        }

        stats.actionsByType[log.action] = (stats.actionsByType[log.action] || 0) + 1;
        stats.actionsBySeverity[log.severity] = (stats.actionsBySeverity[log.severity] || 0) + 1;
        
        if (!stats.lastActivity || new Date(log.timestamp) > new Date(stats.lastActivity)) {
          stats.lastActivity = log.timestamp;
        }
      });

      return Array.from(userStats.values());
    } catch (error) {
      console.error('Erro ao buscar estatísticas de usuário:', error);
      return [];
    }
  }

  /**
   * Obtém tendências de atividade ao longo do tempo
   */
  async getActivityTrends(
    lojistaId: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' = 'day'
  ) {
    try {
      const { data, error } = await supabase.rpc('get_activity_trends', {
        p_lojista_id: lojistaId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_interval: interval
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar tendências de atividade:', error);
      return [];
    }
  }

  /**
   * Detecta padrões anômalos na atividade
   */
  async detectAnomalies(lojistaId: string, hours: number = 24) {
    try {
      const { data, error } = await supabase.rpc('detect_activity_anomalies', {
        p_lojista_id: lojistaId,
        p_hours: hours
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao detectar anomalias:', error);
      return [];
    }
  }

  /**
   * Exporta logs de auditoria
   */
  async exportAuditLogs(
    lojistaId: string,
    filter: AuditFilter,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    try {
      const logs = await this.getAuditLogs({
        ...filter,
        limit: 10000 // Limite para exportação
      });

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      }

      // Formato CSV
      const headers = [
        'Timestamp', 'Usuário', 'Ação', 'Recurso', 'Descrição', 
        'Severidade', 'Status', 'IP', 'Suspeito'
      ];

      const csvRows = [
        headers.join(','),
        ...logs.map(log => [
          log.timestamp,
          log.usuario_id || '',
          log.action,
          log.resource_type,
          `"${log.description.replace(/"/g, '""')}"`,
          log.severity,
          log.status,
          log.ip_address || '',
          log.is_suspicious ? 'Sim' : 'Não'
        ].join(','))
      ];

      return csvRows.join('\n');
    } catch (error) {
      console.error('Erro ao exportar logs:', error);
      throw error;
    }
  }

  /**
   * Calcula tempo médio de resposta
   */
  private calculateAverageResponseTime(logs: any[]): number {
    const logsWithDuration = logs.filter(l => l.duration_ms && l.duration_ms > 0);
    if (logsWithDuration.length === 0) return 0;
    
    const total = logsWithDuration.reduce((sum, log) => sum + log.duration_ms, 0);
    return Math.round(total / logsWithDuration.length * 100) / 100;
  }

  /**
   * Calcula tempo máximo de resposta
   */
  private calculateMaxResponseTime(logs: any[]): number {
    const durations = logs
      .filter(l => l.duration_ms && l.duration_ms > 0)
      .map(l => l.duration_ms);
    
    return durations.length > 0 ? Math.max(...durations) : 0;
  }
}

// Instância singleton
export const auditDashboard = AuditDashboardService.getInstance();