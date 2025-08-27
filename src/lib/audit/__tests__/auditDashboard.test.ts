import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditDashboardService } from '../auditDashboard';

// Mock do Supabase será definido no vi.mock

vi.mock('../../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  single: vi.fn()
                }))
              }))
            }))
          }))
        })),
        order: vi.fn(() => ({
          limit: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      }))
    })),
    rpc: vi.fn()
  }
}));

describe('AuditDashboardService', () => {
  let service: AuditDashboardService;
  let mockSupabase: any;

  beforeEach(async () => {
    service = AuditDashboardService.getInstance();
    const { supabase } = await import('../../supabaseClient');
    mockSupabase = supabase;
    vi.clearAllMocks();
  });

  describe('generateRealtimeMetrics', () => {
    it('deve gerar métricas em tempo real corretamente', async () => {
      const mockLogs = [
        { action: 'CREATE', severity: 'LOW', status: 'SUCCESS', is_suspicious: false, duration_ms: 100 },
        { action: 'READ', severity: 'MEDIUM', status: 'SUCCESS', is_suspicious: false, duration_ms: 50 },
        { action: 'UPDATE', severity: 'HIGH', status: 'FAILURE', is_suspicious: true, duration_ms: 200 },
        { action: 'DELETE', severity: 'CRITICAL', status: 'SUCCESS', is_suspicious: true, duration_ms: 150 },
        { action: 'LOGIN', severity: 'LOW', status: 'FAILURE', is_suspicious: false, duration_ms: null },
        { action: 'EXPORT', severity: 'MEDIUM', status: 'SUCCESS', is_suspicious: false, duration_ms: 300 }
      ];

      mockSupabase.from().select().eq().gte().lte.mockResolvedValue({
        data: mockLogs,
        error: null
      });

      const metrics = await service.generateRealtimeMetrics('lojista-123', 24);

      expect(metrics).toEqual({
        lojista_id: 'lojista-123',
        period_start: expect.any(String),
        period_end: expect.any(String),
        total_events: 6,
        success_events: 4,
        failure_events: 2,
        warning_events: 0,
        low_severity: 2,
        medium_severity: 2,
        high_severity: 1,
        critical_severity: 1,
        create_actions: 1,
        read_actions: 1,
        update_actions: 1,
        delete_actions: 1,
        suspicious_events: 2,
        failed_logins: 1,
        data_exports: 1,
        avg_response_time_ms: 160, // (100 + 50 + 200 + 150 + 300) / 5
        max_response_time_ms: 300
      });
    });

    it('deve tratar logs vazios corretamente', async () => {
      mockSupabase.from().select().eq().gte().lte.mockResolvedValue({
        data: [],
        error: null
      });

      const metrics = await service.generateRealtimeMetrics('lojista-123', 24);

      expect(metrics.total_events).toBe(0);
      expect(metrics.avg_response_time_ms).toBe(0);
      expect(metrics.max_response_time_ms).toBe(0);
    });
  });

  describe('getAuditLogs', () => {
    it('deve aplicar filtros corretamente', async () => {
      const mockLogs = [
        { id: '1', action: 'CREATE', severity: 'LOW', description: 'Test log' }
      ];

      const mockQuery = {
        select: vi.fn(() => mockQuery),
        gte: vi.fn(() => mockQuery),
        lte: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        or: vi.fn(() => mockQuery),
        order: vi.fn(() => mockQuery),
        limit: vi.fn(() => mockQuery),
        range: vi.fn(() => Promise.resolve({ data: mockLogs, error: null }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const filter = {
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-31T23:59:59.999Z',
        action: 'CREATE' as const,
        severity: 'LOW' as const,
        search: 'test',
        limit: 10,
        offset: 0
      };

      const logs = await service.getAuditLogs(filter);

      expect(mockQuery.gte).toHaveBeenCalledWith('timestamp', filter.start_date);
      expect(mockQuery.lte).toHaveBeenCalledWith('timestamp', filter.end_date);
      expect(mockQuery.eq).toHaveBeenCalledWith('action', filter.action);
      expect(mockQuery.eq).toHaveBeenCalledWith('severity', filter.severity);
      expect(mockQuery.or).toHaveBeenCalledWith('description.ilike.%test%,resource_type.ilike.%test%');
      expect(mockQuery.limit).toHaveBeenCalledWith(filter.limit);
      expect(logs).toEqual(mockLogs);
    });
  });

  describe('getUserActivityStats', () => {
    it('deve calcular estatísticas de usuário corretamente', async () => {
      const mockLogs = [
        { usuario_id: 'user1', action: 'CREATE', severity: 'LOW', is_suspicious: false, timestamp: '2024-01-01T10:00:00Z' },
        { usuario_id: 'user1', action: 'READ', severity: 'MEDIUM', is_suspicious: true, timestamp: '2024-01-01T11:00:00Z' },
        { usuario_id: 'user2', action: 'UPDATE', severity: 'HIGH', is_suspicious: false, timestamp: '2024-01-01T12:00:00Z' }
      ];

      mockSupabase.from().select().eq().gte().lte().not.mockResolvedValue({
        data: mockLogs,
        error: null
      });

      const stats = await service.getUserActivityStats(
        'lojista-123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(stats).toHaveLength(2);
      
      const user1Stats = stats.find(s => s.userId === 'user1');
      expect(user1Stats).toEqual({
        userId: 'user1',
        totalActions: 2,
        suspiciousActions: 1,
        actionsByType: { CREATE: 1, read: 1 },
        actionsBySeverity: { LOW: 1, MEDIUM: 1 },
        lastActivity: '2024-01-01T11:00:00Z'
      });
    });
  });

  describe('updateAlertStatus', () => {
    it('deve atualizar status de alerta para INVESTIGATING', async () => {
      mockSupabase.from().update().eq.mockResolvedValue({
        error: null
      });

      const result = await service.updateAlertStatus('alert-123', 'INVESTIGATING', 'user-456');

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'INVESTIGATING',
        assigned_to: 'user-456',
        acknowledged_at: expect.any(String),
        updated_at: expect.any(String)
      });
      expect(result).toBe(true);
    });

    it('deve atualizar status de alerta para RESOLVED', async () => {
      mockSupabase.from().update().eq.mockResolvedValue({
        error: null
      });

      const result = await service.updateAlertStatus('alert-123', 'RESOLVED', undefined, 'Falso positivo');

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'RESOLVED',
        resolved_at: expect.any(String),
        resolution_notes: 'Falso positivo',
        updated_at: expect.any(String)
      });
      expect(result).toBe(true);
    });
  });

  describe('exportAuditLogs', () => {
    it('deve exportar logs em formato CSV', async () => {
      const mockLogs = [
        {
          timestamp: '2024-01-01T10:00:00Z',
          usuario_id: 'user1',
          action: 'CREATE',
          resource_type: 'cliente',
          description: 'Cliente criado',
          severity: 'LOW',
          status: 'SUCCESS',
          ip_address: '192.168.1.1',
          is_suspicious: false
        }
      ];

      // Mock do getAuditLogs
      vi.spyOn(service, 'getAuditLogs').mockResolvedValue(mockLogs);

      const csvData = await service.exportAuditLogs('lojista-123', {}, 'csv');

      const expectedCsv = [
        'Timestamp,Usuário,Ação,Recurso,Descrição,Severidade,Status,IP,Suspeito',
        '2024-01-01T10:00:00Z,user1,CREATE,cliente,"Cliente criado",LOW,SUCCESS,192.168.1.1,Não'
      ].join('\n');

      expect(csvData).toBe(expectedCsv);
    });

    it('deve exportar logs em formato JSON', async () => {
      const mockLogs = [
        { id: '1', action: 'CREATE', description: 'Test' }
      ];

      vi.spyOn(service, 'getAuditLogs').mockResolvedValue(mockLogs);

      const jsonData = await service.exportAuditLogs('lojista-123', {}, 'json');

      expect(jsonData).toBe(JSON.stringify(mockLogs, null, 2));
    });
  });

  describe('getActivityTrends', () => {
    it('deve chamar função RPC corretamente', async () => {
      const mockTrends = [
        { period: '2024-01-01', total_events: 10, success_events: 8 }
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockTrends,
        error: null
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const trends = await service.getActivityTrends('lojista-123', startDate, endDate, 'day');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_activity_trends', {
        p_lojista_id: 'lojista-123',
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_interval: 'day'
      });
      expect(trends).toEqual(mockTrends);
    });
  });

  describe('detectAnomalies', () => {
    it('deve detectar anomalias corretamente', async () => {
      const mockAnomalies = [
        {
          anomaly_type: 'ACTIVITY_SPIKE',
          description: 'Pico de atividade detectado',
          severity: 'HIGH'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockAnomalies,
        error: null
      });

      const anomalies = await service.detectAnomalies('lojista-123', 24);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('detect_activity_anomalies', {
        p_lojista_id: 'lojista-123',
        p_hours: 24
      });
      expect(anomalies).toEqual(mockAnomalies);
    });
  });
});