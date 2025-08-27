import { encryptionService } from './encryptionService';
import { MaskedData, DataProtectionConfig } from './types';
import { formatCPF, formatCNPJ, formatPhone, maskCardNumber } from '../validation/sanitizers';

/**
 * Serviço de proteção de dados sensíveis
 * Implementa mascaramento e criptografia automática
 */
export class DataProtectionService {
  private static instance: DataProtectionService;
  private config: DataProtectionConfig;

  private constructor() {
    this.config = {
      encryptSensitiveFields: true,
      maskDisplayData: true,
      auditDataAccess: true,
      keyRotationDays: 90,
      allowedViewers: []
    };
  }

  public static getInstance(): DataProtectionService {
    if (!DataProtectionService.instance) {
      DataProtectionService.instance = new DataProtectionService();
    }
    return DataProtectionService.instance;
  }

  /**
   * Atualiza a configuração de proteção de dados
   */
  public updateConfig(newConfig: Partial<DataProtectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém a configuração atual
   */
  public getConfig(): DataProtectionConfig {
    return { ...this.config };
  }

  /**
   * Mascara dados sensíveis para exibição
   */
  public maskSensitiveData(data: string, type: MaskedData['type']): MaskedData {
    if (!data || typeof data !== 'string') {
      return { masked: '', type };
    }

    let masked: string;

    switch (type) {
      case 'cpf':
        masked = this.maskCPF(data);
        break;
      case 'cnpj':
        masked = this.maskCNPJ(data);
        break;
      case 'phone':
        masked = this.maskPhone(data);
        break;
      case 'email':
        masked = this.maskEmail(data);
        break;
      case 'card':
        masked = maskCardNumber(data);
        break;
      case 'cvv':
        masked = '***';
        break;
      default:
        masked = this.maskGeneric(data);
    }

    return {
      masked,
      type,
      ...(import.meta.env.DEV && { original: data })
    };
  }

  /**
   * Mascara CPF mantendo apenas os últimos 3 dígitos
   */
  private maskCPF(cpf: string): string {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    
    const masked = `***.***.***-${clean.slice(-2)}`;
    return masked;
  }

  /**
   * Mascara CNPJ mantendo apenas os últimos 4 dígitos
   */
  private maskCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    
    const masked = `**.***.***/****-${clean.slice(-2)}`;
    return masked;
  }

  /**
   * Mascara telefone mantendo apenas o DDD e últimos 2 dígitos
   */
  private maskPhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return phone;
    
    const ddd = clean.slice(0, 2);
    const lastTwo = clean.slice(-2);
    const masked = `(${ddd}) *****-**${lastTwo}`;
    return masked;
  }

  /**
   * Mascara email mantendo apenas o primeiro caractere e domínio
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    
    const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(0, localPart.length - 1));
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mascaramento genérico para outros tipos de dados
   */
  private maskGeneric(data: string): string {
    if (data.length <= 4) {
      return '*'.repeat(data.length);
    }
    
    const visibleChars = Math.ceil(data.length * 0.2); // 20% visível
    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const middle = '*'.repeat(data.length - (visibleChars * 2));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Protege um objeto criptografando campos sensíveis
   */
  public protectSensitiveFields(
    data: Record<string, any>, 
    sensitiveFields: Array<{ field: string; type: MaskedData['type'] }>
  ): Record<string, any> {
    if (!this.config.encryptSensitiveFields) {
      return data;
    }

    const protectedData = { ...data };

    for (const { field, type } of sensitiveFields) {
      if (protectedData[field] && typeof protectedData[field] === 'string') {
        // Criptografa o valor original
        const encrypted = encryptionService.encrypt(protectedData[field]);
        
        // Armazena tanto o valor criptografado quanto o mascarado
        protectedData[field] = {
          encrypted,
          masked: this.maskSensitiveData(protectedData[field], type).masked,
          type
        };
      }
    }

    return protectedData;
  }

  /**
   * Desprotege um objeto descriptografando campos sensíveis
   */
  public unprotectSensitiveFields(
    data: Record<string, any>,
    fieldsToDecrypt: string[],
    userHasPermission: boolean = false
  ): Record<string, any> {
    const unprotected = { ...data };

    for (const field of fieldsToDecrypt) {
      const fieldData = unprotected[field];
      
      if (fieldData && typeof fieldData === 'object' && fieldData.encrypted) {
        if (userHasPermission) {
          // Usuário tem permissão, descriptografa o valor real
          try {
            unprotected[field] = encryptionService.decrypt(fieldData.encrypted);
          } catch (error) {
            console.error(`Erro ao descriptografar campo ${field}:`, error);
            unprotected[field] = fieldData.masked || '***';
          }
        } else {
          // Usuário não tem permissão, retorna apenas o valor mascarado
          unprotected[field] = fieldData.masked || '***';
        }
      }
    }

    return unprotected;
  }

  /**
   * Verifica se um usuário tem permissão para ver dados sensíveis
   */
  public hasViewPermission(userId: string, dataType?: string): boolean {
    // Em um sistema real, isso consultaria o banco de dados ou serviço de autorização
    return this.config.allowedViewers.includes(userId) || 
           this.config.allowedViewers.includes('*');
  }

  /**
   * Registra acesso a dados sensíveis para auditoria
   */
  public auditDataAccess(
    userId: string, 
    dataType: string, 
    recordId: string, 
    action: 'view' | 'decrypt' | 'export'
  ): void {
    if (!this.config.auditDataAccess) {
      return;
    }

    const auditLog = {
      timestamp: new Date().toISOString(),
      userId,
      dataType,
      recordId,
      action,
      ip: this.getClientIP(),
      userAgent: navigator.userAgent
    };

    // Em um sistema real, isso enviaria para um serviço de auditoria
    console.log('Audit Log:', auditLog);
    
    // Armazenar no localStorage para demonstração (em produção usar serviço adequado)
    const existingLogs = JSON.parse(localStorage.getItem('dataAccessAudit') || '[]');
    existingLogs.push(auditLog);
    
    // Manter apenas os últimos 1000 logs
    if (existingLogs.length > 1000) {
      existingLogs.splice(0, existingLogs.length - 1000);
    }
    
    localStorage.setItem('dataAccessAudit', JSON.stringify(existingLogs));
  }

  /**
   * Obtém o IP do cliente (simulado para demonstração)
   */
  private getClientIP(): string {
    // Em um ambiente real, isso viria do servidor
    return '127.0.0.1';
  }

  /**
   * Obtém logs de auditoria
   */
  public getAuditLogs(filters?: {
    userId?: string;
    dataType?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): any[] {
    const logs = JSON.parse(localStorage.getItem('dataAccessAudit') || '[]');
    
    if (!filters) {
      return logs;
    }

    return logs.filter((log: any) => {
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.dataType && log.dataType !== filters.dataType) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.startDate && new Date(log.timestamp) < filters.startDate) return false;
      if (filters.endDate && new Date(log.timestamp) > filters.endDate) return false;
      return true;
    });
  }

  /**
   * Limpa logs de auditoria antigos
   */
  public cleanupAuditLogs(olderThanDays: number = 90): void {
    const logs = JSON.parse(localStorage.getItem('dataAccessAudit') || '[]');
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    
    const filteredLogs = logs.filter((log: any) => 
      new Date(log.timestamp) > cutoffDate
    );
    
    localStorage.setItem('dataAccessAudit', JSON.stringify(filteredLogs));
    console.log(`Removidos ${logs.length - filteredLogs.length} logs de auditoria antigos`);
  }
}

// Instância singleton
export const dataProtectionService = DataProtectionService.getInstance();