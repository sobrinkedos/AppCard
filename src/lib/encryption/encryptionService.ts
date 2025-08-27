import CryptoJS from 'crypto-js';
import { EncryptedData, EncryptionOptions, EncryptionKey } from './types';

/**
 * Serviço de criptografia para dados sensíveis
 * Implementa criptografia AES-256 com suporte a rotação de chaves
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private keys: Map<number, EncryptionKey> = new Map();
  private currentKeyVersion: number = 1;

  private constructor() {
    this.initializeKeys();
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Inicializa as chaves de criptografia
   */
  private initializeKeys(): void {
    // Em produção, essas chaves devem vir de um serviço seguro de gerenciamento de chaves
    const masterKey = import.meta.env.VITE_ENCRYPTION_MASTER_KEY || this.generateSecureKey();
    
    const key: EncryptionKey = {
      id: `key-v${this.currentKeyVersion}`,
      key: masterKey,
      version: this.currentKeyVersion,
      algorithm: 'AES-256-GCM',
      createdAt: new Date(),
      isActive: true
    };

    this.keys.set(this.currentKeyVersion, key);
  }

  /**
   * Gera uma chave segura aleatória
   */
  private generateSecureKey(): string {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  }

  /**
   * Obtém a chave ativa atual
   */
  private getCurrentKey(): EncryptionKey {
    const key = this.keys.get(this.currentKeyVersion);
    if (!key || !key.isActive) {
      throw new Error('Nenhuma chave ativa encontrada');
    }
    return key;
  }

  /**
   * Obtém uma chave específica por versão
   */
  private getKeyByVersion(version: number): EncryptionKey {
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(`Chave versão ${version} não encontrada`);
    }
    return key;
  }

  /**
   * Criptografa dados sensíveis
   */
  public encrypt(data: string, options: EncryptionOptions = {}): EncryptedData {
    if (!data || typeof data !== 'string') {
      throw new Error('Dados para criptografia devem ser uma string não vazia');
    }

    const {
      algorithm = 'AES-256-GCM',
      keyVersion = this.currentKeyVersion,
      additionalData = ''
    } = options;

    const key = this.getKeyByVersion(keyVersion);
    
    try {
      if (algorithm === 'AES-256-GCM') {
        return this.encryptGCM(data, key, additionalData);
      } else {
        return this.encryptCBC(data, key);
      }
    } catch (error) {
      console.error('Erro durante criptografia:', error);
      throw new Error('Falha na criptografia dos dados');
    }
  }

  /**
   * Criptografia AES-256-GCM (fallback para CBC devido a limitações do crypto-js)
   */
  private encryptGCM(data: string, key: EncryptionKey, additionalData: string): EncryptedData {
    // Crypto-js não tem suporte completo para GCM, usando CBC como fallback
    return this.encryptCBC(data, key);
  }

  /**
   * Criptografia AES-256-CBC (fallback)
   */
  private encryptCBC(data: string, key: EncryptionKey): EncryptedData {
    // Gera IV aleatório
    const iv = CryptoJS.lib.WordArray.random(16); // 128 bits para CBC
    
    // Converte a chave para WordArray
    const keyWordArray = CryptoJS.enc.Hex.parse(key.key);
    
    // Criptografa os dados
    const encrypted = CryptoJS.AES.encrypt(data, keyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(CryptoJS.enc.Base64),
      keyVersion: key.version,
      algorithm: 'AES-256-CBC'
    };
  }

  /**
   * Descriptografa dados
   */
  public decrypt(encryptedData: EncryptedData): string {
    if (!encryptedData || !encryptedData.encrypted) {
      throw new Error('Dados criptografados inválidos');
    }

    const key = this.getKeyByVersion(encryptedData.keyVersion || this.currentKeyVersion);
    
    try {
      if (encryptedData.algorithm === 'AES-256-GCM') {
        return this.decryptGCM(encryptedData, key);
      } else {
        return this.decryptCBC(encryptedData, key);
      }
    } catch (error) {
      console.error('Erro durante descriptografia:', error);
      throw new Error('Falha na descriptografia dos dados');
    }
  }

  /**
   * Descriptografia AES-256-GCM (fallback para CBC devido a limitações do crypto-js)
   */
  private decryptGCM(encryptedData: EncryptedData, key: EncryptionKey): string {
    // Crypto-js não tem suporte completo para GCM, usando CBC como fallback
    return this.decryptCBC(encryptedData, key);
  }

  /**
   * Descriptografia AES-256-CBC
   */
  private decryptCBC(encryptedData: EncryptedData, key: EncryptionKey): string {
    const keyWordArray = CryptoJS.enc.Hex.parse(key.key);
    const iv = CryptoJS.enc.Base64.parse(encryptedData.iv);

    const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, keyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Criptografa múltiplos campos de um objeto
   */
  public encryptFields(data: Record<string, any>, fieldsToEncrypt: string[]): Record<string, any> {
    const result = { ...data };
    
    for (const field of fieldsToEncrypt) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field]);
      }
    }
    
    return result;
  }

  /**
   * Descriptografa múltiplos campos de um objeto
   */
  public decryptFields(data: Record<string, any>, fieldsToDecrypt: string[]): Record<string, any> {
    const result = { ...data };
    
    for (const field of fieldsToDecrypt) {
      if (result[field] && typeof result[field] === 'object' && result[field].encrypted) {
        try {
          result[field] = this.decrypt(result[field]);
        } catch (error) {
          console.error(`Erro ao descriptografar campo ${field}:`, error);
          // Mantém o valor criptografado em caso de erro
        }
      }
    }
    
    return result;
  }

  /**
   * Verifica se os dados estão criptografados
   */
  public isEncrypted(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.encrypted === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.algorithm === 'string'
    );
  }

  /**
   * Rotaciona as chaves de criptografia
   */
  public rotateKeys(): void {
    // Desativa a chave atual
    const currentKey = this.getCurrentKey();
    currentKey.isActive = false;
    currentKey.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias para expirar

    // Cria nova chave
    this.currentKeyVersion++;
    const newKey: EncryptionKey = {
      id: `key-v${this.currentKeyVersion}`,
      key: this.generateSecureKey(),
      version: this.currentKeyVersion,
      algorithm: 'AES-256-GCM',
      createdAt: new Date(),
      isActive: true
    };

    this.keys.set(this.currentKeyVersion, newKey);
    
    console.log(`Chaves rotacionadas. Nova versão: ${this.currentKeyVersion}`);
  }

  /**
   * Obtém informações sobre as chaves (sem expor as chaves reais)
   */
  public getKeyInfo(): Array<Omit<EncryptionKey, 'key'>> {
    return Array.from(this.keys.values()).map(key => ({
      id: key.id,
      version: key.version,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive
    }));
  }

  /**
   * Remove chaves expiradas
   */
  public cleanupExpiredKeys(): void {
    const now = new Date();
    const expiredKeys: number[] = [];

    for (const [version, key] of this.keys.entries()) {
      if (key.expiresAt && key.expiresAt < now) {
        expiredKeys.push(version);
      }
    }

    for (const version of expiredKeys) {
      this.keys.delete(version);
      console.log(`Chave expirada removida: versão ${version}`);
    }
  }
}

// Instância singleton
export const encryptionService = EncryptionService.getInstance();