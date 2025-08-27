import { describe, it, expect, beforeEach } from 'vitest';
import { DataProtectionService } from '../dataProtection';

describe('DataProtectionService', () => {
  let dataProtectionService: DataProtectionService;

  beforeEach(() => {
    dataProtectionService = DataProtectionService.getInstance();
    // Limpa localStorage para cada teste
    localStorage.clear();
  });

  describe('Mascaramento de dados', () => {
    it('deve mascarar CPF corretamente', () => {
      const cpf = '12345678901';
      const masked = dataProtectionService.maskSensitiveData(cpf, 'cpf');
      
      expect(masked.masked).toBe('***.***.***-01');
      expect(masked.type).toBe('cpf');
    });

    it('deve mascarar CNPJ corretamente', () => {
      const cnpj = '12345678000190';
      const masked = dataProtectionService.maskSensitiveData(cnpj, 'cnpj');
      
      expect(masked.masked).toBe('**.***.***/****-90');
      expect(masked.type).toBe('cnpj');
    });

    it('deve mascarar telefone corretamente', () => {
      const phone = '11999887766';
      const masked = dataProtectionService.maskSensitiveData(phone, 'phone');
      
      expect(masked.masked).toBe('(11) *****-**66');
      expect(masked.type).toBe('phone');
    });

    it('deve mascarar email corretamente', () => {
      const email = 'joao@exemplo.com';
      const masked = dataProtectionService.maskSensitiveData(email, 'email');
      
      expect(masked.masked).toBe('j***@exemplo.com');
      expect(masked.type).toBe('email');
    });

    it('deve mascarar CVV completamente', () => {
      const cvv = '123';
      const masked = dataProtectionService.maskSensitiveData(cvv, 'cvv');
      
      expect(masked.masked).toBe('***');
      expect(masked.type).toBe('cvv');
    });

    it('deve mascarar dados genéricos', () => {
      const data = 'informacao-sensivel-longa';
      const masked = dataProtectionService.maskSensitiveData(data, 'custom');
      
      expect(masked.masked).toContain('*');
      expect(masked.masked.length).toBe(data.length);
      expect(masked.type).toBe('custom');
    });
  });

  describe('Proteção de campos sensíveis', () => {
    it('deve proteger campos sensíveis de um objeto', () => {
      const data = {
        nome: 'João Silva',
        cpf: '12345678901',
        email: 'joao@exemplo.com',
        telefone: '11999887766'
      };

      const sensitiveFields = [
        { field: 'cpf', type: 'cpf' as const },
        { field: 'telefone', type: 'phone' as const }
      ];

      const protectedData = dataProtectionService.protectSensitiveFields(data, sensitiveFields);
      
      expect(protectedData.nome).toBe('João Silva'); // Não protegido
      expect(protectedData.email).toBe('joao@exemplo.com'); // Não protegido
      expect(protectedData.cpf).toHaveProperty('encrypted');
      expect(protectedData.cpf).toHaveProperty('masked');
      expect(protectedData.telefone).toHaveProperty('encrypted');
      expect(protectedData.telefone).toHaveProperty('masked');
    });

    it('deve desproteger campos com permissão', () => {
      const originalData = {
        cpf: '12345678901',
        telefone: '11999887766'
      };

      const sensitiveFields = [
        { field: 'cpf', type: 'cpf' as const },
        { field: 'telefone', type: 'phone' as const }
      ];

      const protectedData = dataProtectionService.protectSensitiveFields(originalData, sensitiveFields);
      const unprotected = dataProtectionService.unprotectSensitiveFields(
        protectedData, 
        ['cpf', 'telefone'], 
        true // Com permissão
      );
      
      expect(unprotected.cpf).toBe(originalData.cpf);
      expect(unprotected.telefone).toBe(originalData.telefone);
    });

    it('deve retornar dados mascarados sem permissão', () => {
      const originalData = {
        cpf: '12345678901',
        telefone: '11999887766'
      };

      const sensitiveFields = [
        { field: 'cpf', type: 'cpf' as const },
        { field: 'telefone', type: 'phone' as const }
      ];

      const protectedData = dataProtectionService.protectSensitiveFields(originalData, sensitiveFields);
      const unprotected = dataProtectionService.unprotectSensitiveFields(
        protectedData, 
        ['cpf', 'telefone'], 
        false // Sem permissão
      );
      
      expect(unprotected.cpf).toBe('***.***.***-01');
      expect(unprotected.telefone).toBe('(11) *****-**66');
    });
  });

  describe('Auditoria de acesso', () => {
    it('deve registrar acesso a dados sensíveis', () => {
      dataProtectionService.auditDataAccess('user123', 'cpf', 'client456', 'view');
      
      const logs = dataProtectionService.getAuditLogs();
      expect(logs.length).toBe(1);
      
      const log = logs[0];
      expect(log.userId).toBe('user123');
      expect(log.dataType).toBe('cpf');
      expect(log.recordId).toBe('client456');
      expect(log.action).toBe('view');
      expect(log.timestamp).toBeDefined();
    });

    it('deve filtrar logs de auditoria', () => {
      // Adiciona múltiplos logs
      dataProtectionService.auditDataAccess('user1', 'cpf', 'client1', 'view');
      dataProtectionService.auditDataAccess('user2', 'email', 'client2', 'decrypt');
      dataProtectionService.auditDataAccess('user1', 'phone', 'client3', 'export');
      
      // Filtra por usuário
      const user1Logs = dataProtectionService.getAuditLogs({ userId: 'user1' });
      expect(user1Logs.length).toBe(2);
      
      // Filtra por tipo de dados
      const cpfLogs = dataProtectionService.getAuditLogs({ dataType: 'cpf' });
      expect(cpfLogs.length).toBe(1);
      
      // Filtra por ação
      const viewLogs = dataProtectionService.getAuditLogs({ action: 'view' });
      expect(viewLogs.length).toBe(1);
    });

    it('deve limpar logs antigos', () => {
      // Adiciona log atual
      dataProtectionService.auditDataAccess('user1', 'cpf', 'client1', 'view');
      
      // Simula log antigo modificando diretamente o localStorage
      const logs = JSON.parse(localStorage.getItem('dataAccessAudit') || '[]');
      logs.push({
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 dias atrás
        userId: 'user2',
        dataType: 'email',
        recordId: 'client2',
        action: 'view'
      });
      localStorage.setItem('dataAccessAudit', JSON.stringify(logs));
      
      // Limpa logs antigos (90 dias)
      dataProtectionService.cleanupAuditLogs(90);
      
      const remainingLogs = dataProtectionService.getAuditLogs();
      expect(remainingLogs.length).toBe(1);
      expect(remainingLogs[0].userId).toBe('user1');
    });
  });

  describe('Configuração', () => {
    it('deve atualizar configuração corretamente', () => {
      const newConfig = {
        encryptSensitiveFields: false,
        maskDisplayData: false,
        keyRotationDays: 30
      };

      dataProtectionService.updateConfig(newConfig);
      const config = dataProtectionService.getConfig();
      
      expect(config.encryptSensitiveFields).toBe(false);
      expect(config.maskDisplayData).toBe(false);
      expect(config.keyRotationDays).toBe(30);
    });

    it('deve verificar permissões corretamente', () => {
      // Configura usuários permitidos
      dataProtectionService.updateConfig({
        allowedViewers: ['admin', 'supervisor']
      });

      expect(dataProtectionService.hasViewPermission('admin')).toBe(true);
      expect(dataProtectionService.hasViewPermission('supervisor')).toBe(true);
      expect(dataProtectionService.hasViewPermission('user')).toBe(false);
      
      // Testa permissão global
      dataProtectionService.updateConfig({
        allowedViewers: ['*']
      });
      
      expect(dataProtectionService.hasViewPermission('qualquer-usuario')).toBe(true);
    });
  });
});