import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from '../encryptionService';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    // Cria uma nova instância para cada teste
    encryptionService = EncryptionService.getInstance();
  });

  describe('Criptografia básica', () => {
    it('deve criptografar e descriptografar dados corretamente', () => {
      const originalData = 'Dados sensíveis para teste';
      
      const encrypted = encryptionService.encrypt(originalData);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-CBC');
      
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(originalData);
    });

    it('deve gerar IVs diferentes para cada criptografia', () => {
      const data = 'Mesmo dado';
      
      const encrypted1 = encryptionService.encrypt(data);
      const encrypted2 = encryptionService.encrypt(data);
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });

    it('deve criptografar com algoritmo CBC quando especificado', () => {
      const data = 'Teste CBC';
      
      const encrypted = encryptionService.encrypt(data, { algorithm: 'AES-256-CBC' });
      expect(encrypted.algorithm).toBe('AES-256-CBC');
      
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(data);
    });
  });

  describe('Validação de entrada', () => {
    it('deve rejeitar dados vazios', () => {
      expect(() => encryptionService.encrypt('')).toThrow('Dados para criptografia devem ser uma string não vazia');
    });

    it('deve rejeitar dados não string', () => {
      expect(() => encryptionService.encrypt(null as any)).toThrow('Dados para criptografia devem ser uma string não vazia');
      expect(() => encryptionService.encrypt(123 as any)).toThrow('Dados para criptografia devem ser uma string não vazia');
    });

    it('deve rejeitar dados criptografados inválidos na descriptografia', () => {
      expect(() => encryptionService.decrypt(null as any)).toThrow('Dados criptografados inválidos');
      expect(() => encryptionService.decrypt({ encrypted: '' } as any)).toThrow('Dados criptografados inválidos');
    });
  });

  describe('Criptografia de múltiplos campos', () => {
    it('deve criptografar múltiplos campos de um objeto', () => {
      const data = {
        nome: 'João Silva',
        cpf: '12345678901',
        email: 'joao@exemplo.com',
        telefone: '11999887766'
      };

      const encrypted = encryptionService.encryptFields(data, ['cpf', 'telefone']);
      
      expect(encrypted.nome).toBe('João Silva'); // Não criptografado
      expect(encrypted.email).toBe('joao@exemplo.com'); // Não criptografado
      expect(encryptionService.isEncrypted(encrypted.cpf)).toBe(true);
      expect(encryptionService.isEncrypted(encrypted.telefone)).toBe(true);
    });

    it('deve descriptografar múltiplos campos de um objeto', () => {
      const originalData = {
        nome: 'João Silva',
        cpf: '12345678901',
        telefone: '11999887766'
      };

      const encrypted = encryptionService.encryptFields(originalData, ['cpf', 'telefone']);
      const decrypted = encryptionService.decryptFields(encrypted, ['cpf', 'telefone']);
      
      expect(decrypted.cpf).toBe(originalData.cpf);
      expect(decrypted.telefone).toBe(originalData.telefone);
      expect(decrypted.nome).toBe(originalData.nome);
    });
  });

  describe('Detecção de dados criptografados', () => {
    it('deve identificar corretamente dados criptografados', () => {
      const data = 'Teste';
      const encrypted = encryptionService.encrypt(data);
      
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
      expect(encryptionService.isEncrypted(data)).toBe(false);
      expect(encryptionService.isEncrypted(null)).toBe(false);
      expect(encryptionService.isEncrypted({})).toBe(false);
    });
  });

  describe('Gerenciamento de chaves', () => {
    it('deve fornecer informações sobre as chaves sem expor as chaves reais', () => {
      const keyInfo = encryptionService.getKeyInfo();
      
      expect(keyInfo).toBeInstanceOf(Array);
      expect(keyInfo.length).toBeGreaterThan(0);
      
      const firstKey = keyInfo[0];
      expect(firstKey).toHaveProperty('id');
      expect(firstKey).toHaveProperty('version');
      expect(firstKey).toHaveProperty('algorithm');
      expect(firstKey).toHaveProperty('createdAt');
      expect(firstKey).toHaveProperty('isActive');
      expect(firstKey).not.toHaveProperty('key'); // Não deve expor a chave real
    });

    it('deve rotacionar chaves corretamente', () => {
      const initialKeyInfo = encryptionService.getKeyInfo();
      const initialActiveKeys = initialKeyInfo.filter(k => k.isActive);
      
      encryptionService.rotateKeys();
      
      const newKeyInfo = encryptionService.getKeyInfo();
      const newActiveKeys = newKeyInfo.filter(k => k.isActive);
      
      expect(newKeyInfo.length).toBe(initialKeyInfo.length + 1);
      expect(newActiveKeys.length).toBe(1);
      expect(newActiveKeys[0].version).toBe(initialActiveKeys[0].version + 1);
    });
  });

  describe('Compatibilidade com versões de chave', () => {
    it('deve descriptografar dados com chaves antigas após rotação', () => {
      const data = 'Dados importantes';
      
      // Criptografa com chave atual
      const encrypted = encryptionService.encrypt(data);
      
      // Rotaciona chaves
      encryptionService.rotateKeys();
      
      // Deve ainda conseguir descriptografar com chave antiga
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(data);
    });
  });
});