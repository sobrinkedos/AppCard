import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncryptedDataService } from '../encryptedDataService';

// Mock do Supabase
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ select: mockSelect, single: mockSingle }));
const mockOrder = vi.fn(() => ({ limit: vi.fn() }));
const mockLimit = vi.fn();
const mockRange = vi.fn();
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));

const mockSupabase = {
  from: vi.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
    select: vi.fn(() => ({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      range: mockRange,
      single: mockSingle
    }))
  }))
};

// Mock dos serviços de criptografia
vi.mock('../supabaseClient', () => ({
  supabase: mockSupabase
}));

vi.mock('../encryption/dataProtection', () => ({
  dataProtectionService: {
    protectSensitiveFields: vi.fn((data, fields) => {
      const result = { ...data };
      fields.forEach(({ field }) => {
        if (result[field]) {
          result[field] = {
            encrypted: { encrypted: 'encrypted_' + result[field], iv: 'test_iv', algorithm: 'AES-256-CBC' },
            masked: '***',
            type: 'generic'
          };
        }
      });
      return result;
    }),
    unprotectSensitiveFields: vi.fn((data, fields, hasPermission) => {
      const result = { ...data };
      fields.forEach(field => {
        if (result[field] && typeof result[field] === 'object' && result[field].encrypted) {
          result[field] = hasPermission ? 'decrypted_' + field : result[field].masked;
        }
      });
      return result;
    })
  }
}));

vi.mock('../audit/auditLogger', () => ({
  auditLogger: {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logRead: vi.fn(),
    logError: vi.fn()
  }
}));

describe('EncryptedDataService', () => {
  let service: EncryptedDataService;

  beforeEach(() => {
    service = EncryptedDataService.getInstance();
    vi.clearAllMocks();
  });

  describe('insert', () => {
    it('deve criptografar campos sensíveis antes de inserir', async () => {
      const mockData = {
        nome: 'João Silva',
        cpf: '12345678901',
        email: 'joao@teste.com',
        telefone: '11999998888'
      };

      const mockResult = { id: '123', ...mockData };
      
      mockSingle.mockResolvedValue({
        data: mockResult,
        error: null
      });

      const result = await service.insert('clientes', mockData, {
        select: '*',
        userId: 'user123',
        auditContext: 'Teste de inserção'
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      
      // Verificar se os campos sensíveis foram criptografados
      const insertCall = mockSupabase.from().insert;
      expect(insertCall).toHaveBeenCalledWith([
        expect.objectContaining({
          nome: 'João Silva', // Campo não sensível mantido
          cpf: expect.objectContaining({
            encrypted: expect.any(Object),
            masked: '***'
          }),
          telefone: expect.objectContaining({
            encrypted: expect.any(Object),
            masked: '***'
          })
        })
      ]);
    });

    it('deve tratar erros de inserção corretamente', async () => {
      const mockData = { nome: 'Teste' };
      const mockError = { message: 'Erro de inserção', code: '23505' };

      mockSingle.mockResolvedValue({
        data: null,
        error: mockError
      });

      const result = await service.insert('clientes', mockData);

      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe('update', () => {
    it('deve criptografar campos sensíveis antes de atualizar', async () => {
      const mockData = {
        cpf: '98765432100',
        telefone: '11888887777'
      };

      const mockResult = { id: '123', ...mockData };
      
      mockSingle.mockResolvedValue({
        data: mockResult,
        error: null
      });

      const result = await service.update('clientes', mockData, { id: '123' }, {
        select: '*',
        userId: 'user123'
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      
      // Verificar se a atualização foi chamada com dados criptografados
      const updateCall = mockSupabase.from().update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          cpf: expect.objectContaining({
            encrypted: expect.any(Object),
            masked: '***'
          })
        })
      );
    });
  });

  describe('select', () => {
    it('deve descriptografar campos sensíveis após buscar', async () => {
      const mockData = [
        {
          id: '123',
          nome: 'João Silva',
          cpf: {
            encrypted: { encrypted: 'encrypted_cpf', iv: 'test_iv', algorithm: 'AES-256-CBC' },
            masked: '***.***.***-**',
            type: 'cpf'
          }
        }
      ];

      mockLimit.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await service.select('clientes', {
        userId: 'user123',
        userHasPermission: true
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data![0].cpf).toBe('decrypted_cpf');
    });

    it('deve retornar dados mascarados quando usuário não tem permissão', async () => {
      const mockData = [
        {
          id: '123',
          nome: 'João Silva',
          cpf: {
            encrypted: { encrypted: 'encrypted_cpf', iv: 'test_iv', algorithm: 'AES-256-CBC' },
            masked: '***.***.***-**',
            type: 'cpf'
          }
        }
      ];

      mockLimit.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await service.select('clientes', {
        userId: 'user123',
        userHasPermission: false
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data![0].cpf).toBe('***.***.***-**');
    });
  });

  describe('selectSingle', () => {
    it('deve buscar um único registro com descriptografia', async () => {
      const mockData = {
        id: '123',
        nome: 'João Silva',
        cpf: {
          encrypted: { encrypted: 'encrypted_cpf', iv: 'test_iv', algorithm: 'AES-256-CBC' },
          masked: '***.***.***-**',
          type: 'cpf'
        }
      };

      mockSingle.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await service.selectSingle('clientes', { id: '123' }, {
        userId: 'user123',
        userHasPermission: true
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data!.cpf).toBe('decrypted_cpf');
    });
  });

  describe('configuração de campos sensíveis', () => {
    it('deve permitir atualizar configuração de campos sensíveis', () => {
      const newConfig = [
        { field: 'numero_cartao', type: 'card' as const },
        { field: 'cvv', type: 'cvv' as const }
      ];

      service.updateSensitiveFieldsConfig('cartoes', newConfig);
      
      const config = service.getSensitiveFieldsConfig();
      expect(config.cartoes).toEqual(newConfig);
    });

    it('deve retornar configuração atual', () => {
      const config = service.getSensitiveFieldsConfig();
      
      expect(config).toHaveProperty('clientes');
      expect(config).toHaveProperty('cartoes');
      expect(config.clientes).toContainEqual({ field: 'cpf', type: 'cpf' });
    });
  });

  describe('migração de dados', () => {
    it('deve simular migração em modo dry run', async () => {
      const mockBatch = [
        { id: '1', cpf: '12345678901', nome: 'João' },
        { id: '2', cpf: '98765432100', nome: 'Maria' }
      ];

      mockRange.mockResolvedValue({
        data: mockBatch,
        error: null
      });

      const result = await service.migrateExistingData('clientes', {
        dryRun: true,
        batchSize: 2
      });

      expect(result.migrated).toBe(2);
      expect(result.errors).toHaveLength(0);
      
      // Em dry run, não deve fazer updates
      expect(mockSupabase.from().update).not.toHaveBeenCalled();
    });
  });
});