import { encryptionService } from './encryptionService';
import { dataProtectionService } from './dataProtection';

/**
 * Serviço de rotação automática de chaves de criptografia
 */
export class KeyRotationService {
  private static instance: KeyRotationService;
  private rotationInterval: NodeJS.Timeout | null = null;
  private isRotating: boolean = false;

  private constructor() {}

  public static getInstance(): KeyRotationService {
    if (!KeyRotationService.instance) {
      KeyRotationService.instance = new KeyRotationService();
    }
    return KeyRotationService.instance;
  }

  /**
   * Inicia a rotação automática de chaves
   */
  public startAutoRotation(intervalDays: number = 90): void {
    if (this.rotationInterval) {
      this.stopAutoRotation();
    }

    const intervalMs = intervalDays * 24 * 60 * 60 * 1000; // Converte dias para milissegundos
    
    this.rotationInterval = setInterval(() => {
      this.performKeyRotation();
    }, intervalMs);

    console.log(`Rotação automática de chaves iniciada. Intervalo: ${intervalDays} dias`);
  }

  /**
   * Para a rotação automática de chaves
   */
  public stopAutoRotation(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
      console.log('Rotação automática de chaves parada');
    }
  }

  /**
   * Executa a rotação de chaves
   */
  public async performKeyRotation(): Promise<void> {
    if (this.isRotating) {
      console.log('Rotação de chaves já em andamento');
      return;
    }

    this.isRotating = true;
    console.log('Iniciando rotação de chaves...');

    try {
      // 1. Rotaciona as chaves no serviço de criptografia
      encryptionService.rotateKeys();

      // 2. Agenda a re-criptografia de dados existentes (em background)
      this.scheduleDataReEncryption();

      // 3. Remove chaves expiradas
      encryptionService.cleanupExpiredKeys();

      // 4. Limpa logs de auditoria antigos
      const config = dataProtectionService.getConfig();
      dataProtectionService.cleanupAuditLogs(config.keyRotationDays * 2);

      console.log('Rotação de chaves concluída com sucesso');
    } catch (error) {
      console.error('Erro durante rotação de chaves:', error);
      throw error;
    } finally {
      this.isRotating = false;
    }
  }

  /**
   * Agenda a re-criptografia de dados existentes
   * Em um sistema real, isso seria feito em background por um worker
   */
  private scheduleDataReEncryption(): void {
    // Simula o agendamento da re-criptografia
    console.log('Re-criptografia de dados existentes agendada para execução em background');
    
    // Em um sistema real, você faria algo como:
    // - Adicionar jobs em uma fila (Redis, RabbitMQ, etc.)
    // - Processar dados em lotes pequenos
    // - Manter compatibilidade com chaves antigas durante a transição
    
    setTimeout(() => {
      console.log('Simulação: Re-criptografia de dados concluída');
    }, 5000);
  }

  /**
   * Verifica se é necessário rotacionar as chaves
   */
  public shouldRotateKeys(): boolean {
    const keyInfo = encryptionService.getKeyInfo();
    const activeKey = keyInfo.find(key => key.isActive);
    
    if (!activeKey) {
      return true; // Sem chave ativa, precisa rotacionar
    }

    const config = dataProtectionService.getConfig();
    const rotationThreshold = config.keyRotationDays * 24 * 60 * 60 * 1000;
    const keyAge = Date.now() - activeKey.createdAt.getTime();

    return keyAge > rotationThreshold;
  }

  /**
   * Obtém estatísticas sobre as chaves
   */
  public getKeyStatistics(): {
    totalKeys: number;
    activeKeys: number;
    oldestKeyAge: number;
    newestKeyAge: number;
    nextRotationDue: Date | null;
  } {
    const keyInfo = encryptionService.getKeyInfo();
    const config = dataProtectionService.getConfig();
    
    const activeKeys = keyInfo.filter(key => key.isActive);
    const keyAges = keyInfo.map(key => Date.now() - key.createdAt.getTime());
    
    let nextRotationDue: Date | null = null;
    if (activeKeys.length > 0) {
      const newestActiveKey = activeKeys.reduce((newest, key) => 
        key.createdAt > newest.createdAt ? key : newest
      );
      nextRotationDue = new Date(
        newestActiveKey.createdAt.getTime() + (config.keyRotationDays * 24 * 60 * 60 * 1000)
      );
    }

    return {
      totalKeys: keyInfo.length,
      activeKeys: activeKeys.length,
      oldestKeyAge: keyAges.length > 0 ? Math.max(...keyAges) : 0,
      newestKeyAge: keyAges.length > 0 ? Math.min(...keyAges) : 0,
      nextRotationDue
    };
  }

  /**
   * Força a rotação imediata das chaves (para uso administrativo)
   */
  public async forceKeyRotation(): Promise<void> {
    console.log('Rotação forçada de chaves solicitada');
    await this.performKeyRotation();
  }

  /**
   * Verifica a saúde do sistema de chaves
   */
  public checkKeyHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const keyInfo = encryptionService.getKeyInfo();
    const config = dataProtectionService.getConfig();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Verifica se há chaves ativas
    const activeKeys = keyInfo.filter(key => key.isActive);
    if (activeKeys.length === 0) {
      issues.push('Nenhuma chave ativa encontrada');
    } else if (activeKeys.length > 1) {
      issues.push('Múltiplas chaves ativas encontradas');
    }

    // Verifica idade das chaves
    const rotationThreshold = config.keyRotationDays * 24 * 60 * 60 * 1000;
    for (const key of activeKeys) {
      const keyAge = Date.now() - key.createdAt.getTime();
      if (keyAge > rotationThreshold) {
        issues.push(`Chave ${key.id} está vencida (${Math.floor(keyAge / (24 * 60 * 60 * 1000))} dias)`);
      } else if (keyAge > rotationThreshold * 0.8) {
        recommendations.push(`Chave ${key.id} deve ser rotacionada em breve`);
      }
    }

    // Verifica chaves expiradas não removidas
    const expiredKeys = keyInfo.filter(key => key.expiresAt && key.expiresAt < new Date());
    if (expiredKeys.length > 0) {
      recommendations.push(`${expiredKeys.length} chave(s) expirada(s) podem ser removidas`);
    }

    // Determina status geral
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) {
      status = activeKeys.length === 0 ? 'critical' : 'warning';
    } else if (recommendations.length > 0) {
      status = 'warning';
    }

    return {
      status,
      issues,
      recommendations
    };
  }
}

// Instância singleton
export const keyRotationService = KeyRotationService.getInstance();