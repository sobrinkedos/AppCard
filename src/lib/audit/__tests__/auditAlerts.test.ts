import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditAlertsService } from '../auditAlerts';

// Mock do Supabase será definido no vi.mock

vi.mock('../../supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            single: vi.fn()
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'user-123' } }
      }))
    }
  }
}));

describe('AuditAlertsService', () => {
  let service: AuditAlertsService;
  let mockSupabase: any;

  beforeEach(async () => {
    service = AuditAlertsService.getInstance();
    const { supabase } = await import('../../supabaseClient');
    mockSupabase = supabase;
    vi.clearAllMocks();
  });

  describe('startRealtimeMonitoring', () => {
    it('deve iniciar monitoramento em tempo real', () => {
      const mockChannel = {
        on: vi.fn(() => mockChannel),
        subscribe: vi.fn()
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      service.startRealtimeMonitoring('lojista-123');

      expect(mockSupabase.channel).toHaveBeenCalledWith('audit_logs');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs_auditoria',
          filter: 'lojista_id=eq.lojista-123'
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  describe('stopRealtimeMonitoring', () => {
    it('deve parar monitoramento em tempo real', () => {
      // Primeiro iniciar o monitoramento
      const mockChannel = {
        on: vi.fn(() => mockChannel),
        subscribe: vi.fn()
      };
      mockSupabase.channel.mockReturnValue(mockChannel);
      service.startRealtimeMonitoring('lojista-123');

      // Então parar
      service.stopRealtimeMonitoring();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('onAlert e offAlert', () => {
    it('deve registrar e remover callbacks de alerta', () => {
      const callback = vi.fn();

      service.onAlert('test-callback', callback);
      service.offAlert('test-callback');

      // Testar que o callback foi removido
      service.testAlert('TEST_ALERT', { test: true });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('testAlert', () => {
    it('deve executar callback de teste', () => {
      const callback = vi.fn();
      service.onAlert('test-callback', callback);

      service.testAlert('TEST_ALERT', { test: true });

      expect(callback).toHaveBeenCalledWith({
        alert_type: 'TEST_ALERT',
        title: 'Teste: TEST_ALERT',
        message: 'Alerta de teste com dados: {"test":true}',
        severity: 'LOW',
        status: 'OPEN',
        triggered_at: expect.any(String),
        metadata: { test: true }
      });
    });
  });

  describe('updateAlertRules', () => {
    it('deve atualizar regras de alerta', () => {
      const newRules = {
        FAILED_LOGIN_ATTEMPTS: {
          threshold: 10,
          timeWindow: 30 * 60 * 1000,
          severity: 'CRITICAL' as const
        }
      };

      service.updateAlertRules(newRules);
      const rules = service.getAlertRules();

      expect(rules.FAILED_LOGIN_ATTEMPTS.threshold).toBe(10);
      expect(rules.FAILED_LOGIN_ATTEMPTS.severity).toBe('CRITICAL');
    });
  });

  describe('getAlertStatistics', () => {
    it('deve calcular estatísticas de alertas corretamente', async () => {
      const mockAlerts = [
        {
          alert_type: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'HIGH',
          status: 'OPEN',
          triggered_at: '2024-01-15T10:00:00Z'
        },
        {
          alert_type: 'RATE_LIMIT_EXCEEDED',
          severity: 'MEDIUM',
          status: 'RESOLVED',
          triggered_at: '2024-01-20T15:00:00Z'
        },
        {
          alert_type: 'FAILED_LOGIN_ATTEMPTS',
          severity: 'HIGH',
          status: 'OPEN',
          triggered_at: '2024-01-25T12:00:00Z'
        }
      ];

      mockSupabase.from().select().eq().gte.mockResolvedValue({
        data: mockAlerts,
        error: null
      });

      const stats = await service.getAlertStatistics('lojista-123', 30);

      expect(stats).toEqual({
        total: 3,
        byType: {
          'FAILED_LOGIN_ATTEMPTS': 2,
          'RATE_LIMIT_EXCEEDED': 1
        },
        bySeverity: {
          'HIGH': 2,
          'MEDIUM': 1
        },
        byStatus: {
          'OPEN': 2,
          'RESOLVED': 1
        },
        trend: expect.any(Array)
      });

      // Verificar que a tendência tem o número correto de dias
      expect(stats.trend).toHaveLength(30);
    });
  });

  describe('processNewAuditLog', () => {
    beforeEach(() => {
      // Mock das funções de verificação
      vi.spyOn(service as any, 'checkFailedLoginAttempts').mockImplementation(() => Promise.resolve());
      vi.spyOn(service as any, 'checkRateLimitExceeded').mockImplementation(() => Promise.resolve());
      vi.spyOn(service as any, 'checkOffHoursAccess').mockImplementation(() => Promise.resolve());
      vi.spyOn(service as any, 'checkBulkDataExport').mockImplementation(() => Promise.resolve());
      vi.spyOn(service as any, 'checkCriticalAdminAction').mockImplementation(() => Promise.resolve());
      vi.spyOn(service as any, 'checkAnomalousAccess').mockImplementation(() => Promise.resolve());
      vi.spyOn(service as any, 'createAlert').mockImplementation(() => Promise.resolve());
    });

    it('deve processar novo log e verificar todas as regras', async () => {
      const mockLog = {
        id: 'log-123',
        action: 'LOGIN',
        status: 'FAILURE',
        usuario_id: 'user-456',
        timestamp: new Date().toISOString()
      };

      await (service as any).processNewAuditLog(mockLog);

      expect((service as any).checkFailedLoginAttempts).toHaveBeenCalledWith(mockLog, []);
      expect((service as any).checkRateLimitExceeded).toHaveBeenCalledWith(mockLog, []);
      expect((service as any).checkOffHoursAccess).toHaveBeenCalledWith(mockLog, []);
      expect((service as any).checkBulkDataExport).toHaveBeenCalledWith(mockLog, []);
      expect((service as any).checkCriticalAdminAction).toHaveBeenCalledWith(mockLog, []);
      expect((service as any).checkAnomalousAccess).toHaveBeenCalledWith(mockLog, []);
    });
  });

  describe('checkOffHoursAccess', () => {
    it('deve detectar acesso fora do horário', async () => {
      const alerts: any[] = [];
      
      // Mock de log com ação sensível fora do horário (23:00)
      const mockLog = {
        action: 'DECRYPT',
        timestamp: '2024-01-15T23:00:00Z' // 23:00 UTC
      };

      await (service as any).checkOffHoursAccess(mockLog, alerts);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual({
        alert_type: 'OFF_HOURS_ACCESS',
        title: 'Acesso Fora do Horário',
        message: expect.stringContaining('Ação DECRYPT executada às'),
        severity: 'MEDIUM'
      });
    });

    it('não deve alertar para ações normais em horário comercial', async () => {
      const alerts: any[] = [];
      
      const mockLog = {
        action: 'READ',
        timestamp: '2024-01-15T14:00:00Z' // 14:00 UTC
      };

      await (service as any).checkOffHoursAccess(mockLog, alerts);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('checkCriticalAdminAction', () => {
    it('deve detectar ação administrativa crítica', async () => {
      const alerts: any[] = [];
      
      const mockLog = {
        action: 'DELETE',
        resource_type: 'cliente',
        description: 'Cliente excluído permanentemente'
      };

      await (service as any).checkCriticalAdminAction(mockLog, alerts);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual({
        alert_type: 'CRITICAL_ADMIN_ACTION',
        title: 'Ação Administrativa Crítica',
        message: 'Ação DELETE executada em cliente: Cliente excluído permanentemente',
        severity: 'CRITICAL'
      });
    });

    it('não deve alertar para ações não críticas', async () => {
      const alerts: any[] = [];
      
      const mockLog = {
        action: 'read',
        resource_type: 'cliente',
        description: 'Visualização de cliente'
      };

      await (service as any).checkCriticalAdminAction(mockLog, alerts);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('checkBulkDataExport', () => {
    it('deve detectar exportação de grande volume', async () => {
      const alerts: any[] = [];
      
      const mockLog = {
        action: 'EXPORT',
        resource_type: 'clientes',
        new_values: {
          record_count: 5000
        }
      };

      await (service as any).checkBulkDataExport(mockLog, alerts);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual({
        alert_type: 'BULK_DATA_EXPORT',
        title: 'Exportação de Grande Volume',
        message: 'Exportação de 5000 registros de clientes',
        severity: 'HIGH'
      });
    });

    it('não deve alertar para exportações pequenas', async () => {
      const alerts: any[] = [];
      
      const mockLog = {
        action: 'EXPORT',
        resource_type: 'clientes',
        new_values: {
          record_count: 50
        }
      };

      await (service as any).checkBulkDataExport(mockLog, alerts);

      expect(alerts).toHaveLength(0);
    });
  });
});