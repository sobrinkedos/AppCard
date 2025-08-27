// Tipos para o sistema de criptografia

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag?: string;
  keyVersion?: number;
  algorithm: string;
}

export interface EncryptionKey {
  id: string;
  key: string;
  version: number;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface EncryptionOptions {
  algorithm?: 'AES-256-GCM' | 'AES-256-CBC';
  keyVersion?: number;
  additionalData?: string;
}

export interface MaskedData {
  masked: string;
  original?: string; // Apenas para desenvolvimento/debug
  type: 'cpf' | 'cnpj' | 'phone' | 'email' | 'card' | 'cvv' | 'custom';
}

export interface DataProtectionConfig {
  encryptSensitiveFields: boolean;
  maskDisplayData: boolean;
  auditDataAccess: boolean;
  keyRotationDays: number;
  allowedViewers: string[];
}