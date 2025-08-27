import { describe, it, expect } from 'vitest';
import {
  validateCPF,
  validateCNPJ,
  validateEmail,
  validatePhone,
  validateCurrency,
  validateCardNumber,
  validateCVV,
  validateFullName,
  validatePassword
} from '../validators';

describe('Validadores', () => {
  describe('validateCPF', () => {
    it('deve validar CPF válido', () => {
      const result = validateCPF('11144477735');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('11144477735');
    });

    it('deve validar CPF com formatação', () => {
      const result = validateCPF('111.444.777-35');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('11144477735');
    });

    it('deve rejeitar CPF inválido', () => {
      const result = validateCPF('12345678901');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CPF_INVALID_CHECKSUM');
    });

    it('deve rejeitar CPF com todos os dígitos iguais', () => {
      const result = validateCPF('11111111111');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CPF_INVALID_SEQUENCE');
    });

    it('deve rejeitar CPF com tamanho inválido', () => {
      const result = validateCPF('123456789');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CPF_INVALID_LENGTH');
    });
  });

  describe('validateCNPJ', () => {
    it('deve validar CNPJ válido', () => {
      const result = validateCNPJ('11222333000181');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('11222333000181');
    });

    it('deve validar CNPJ com formatação', () => {
      const result = validateCNPJ('11.222.333/0001-81');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('11222333000181');
    });

    it('deve rejeitar CNPJ inválido', () => {
      const result = validateCNPJ('12345678000100');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CNPJ_INVALID_CHECKSUM');
    });

    it('deve rejeitar CNPJ com tamanho inválido', () => {
      const result = validateCNPJ('123456789');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CNPJ_INVALID_LENGTH');
    });
  });

  describe('validateEmail', () => {
    it('deve validar email válido', () => {
      const result = validateEmail('teste@exemplo.com');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('teste@exemplo.com');
    });

    it('deve normalizar email para minúsculas', () => {
      const result = validateEmail('TESTE@EXEMPLO.COM');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('teste@exemplo.com');
    });

    it('deve rejeitar email inválido', () => {
      const result = validateEmail('email-invalido');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('EMAIL_INVALID_FORMAT');
    });

    it('deve rejeitar email vazio', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('EMAIL_REQUIRED');
    });

    it('deve rejeitar email muito longo', () => {
      const longEmail = 'a'.repeat(250) + '@exemplo.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      // Pode ser EMAIL_TOO_LONG ou EMAIL_INVALID_FORMAT dependendo da validação
      expect(['EMAIL_TOO_LONG', 'EMAIL_INVALID_FORMAT']).toContain(result.errors[0].code);
    });
  });

  describe('validatePhone', () => {
    it('deve validar telefone fixo válido', () => {
      const result = validatePhone('1133334444');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('1133334444');
    });

    it('deve validar celular válido', () => {
      const result = validatePhone('11999887766');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('11999887766');
    });

    it('deve validar telefone com formatação', () => {
      const result = validatePhone('(11) 99988-7766');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('11999887766');
    });

    it('deve aceitar telefone vazio (opcional)', () => {
      const result = validatePhone('');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('');
    });

    it('deve rejeitar telefone com DDD inválido', () => {
      const result = validatePhone('0999887766');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('PHONE_INVALID_DDD');
    });

    it('deve rejeitar celular sem 9', () => {
      const result = validatePhone('11888776655');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('PHONE_INVALID_MOBILE_FORMAT');
    });
  });

  describe('validateCurrency', () => {
    it('deve validar valor numérico válido', () => {
      const result = validateCurrency(100.50);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(100.50);
    });

    it('deve validar string numérica válida', () => {
      const result = validateCurrency('100,50');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(100.50);
    });

    it('deve validar valor com formatação monetária', () => {
      const result = validateCurrency('R$ 1.000,50');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(1000.50);
    });

    it('deve rejeitar valor negativo', () => {
      const result = validateCurrency(-100);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CURRENCY_NEGATIVE');
    });

    it('deve rejeitar valor com muitas casas decimais', () => {
      const result = validateCurrency(100.123);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CURRENCY_TOO_MANY_DECIMALS');
    });

    it('deve rejeitar valor muito grande', () => {
      const result = validateCurrency(2000000000);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CURRENCY_TOO_LARGE');
    });
  });

  describe('validateCardNumber', () => {
    it('deve validar número de cartão válido (Visa)', () => {
      const result = validateCardNumber('4532015112830366');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('4532015112830366');
    });

    it('deve validar número de cartão com espaços', () => {
      const result = validateCardNumber('4532 0151 1283 0366');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('4532015112830366');
    });

    it('deve rejeitar número de cartão inválido', () => {
      const result = validateCardNumber('1234567890123456');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CARD_NUMBER_INVALID_CHECKSUM');
    });

    it('deve rejeitar número muito curto', () => {
      const result = validateCardNumber('123456789012');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CARD_NUMBER_INVALID_LENGTH');
    });
  });

  describe('validateCVV', () => {
    it('deve validar CVV de 3 dígitos', () => {
      const result = validateCVV('123');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('123');
    });

    it('deve validar CVV de 4 dígitos', () => {
      const result = validateCVV('1234');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('1234');
    });

    it('deve rejeitar CVV muito curto', () => {
      const result = validateCVV('12');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CVV_INVALID_LENGTH');
    });

    it('deve rejeitar CVV muito longo', () => {
      const result = validateCVV('12345');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('CVV_INVALID_LENGTH');
    });
  });

  describe('validateFullName', () => {
    it('deve validar nome completo válido', () => {
      const result = validateFullName('João Silva Santos');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('João Silva Santos');
    });

    it('deve validar nome com acentos', () => {
      const result = validateFullName('José da Conceição');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('José da Conceição');
    });

    it('deve rejeitar nome sem sobrenome', () => {
      const result = validateFullName('João');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('NAME_MISSING_SURNAME');
    });

    it('deve rejeitar nome vazio', () => {
      const result = validateFullName('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('NAME_REQUIRED');
    });

    it('deve rejeitar nome muito curto', () => {
      const result = validateFullName('A');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('NAME_TOO_SHORT');
    });

    it('deve rejeitar nome com caracteres inválidos', () => {
      const result = validateFullName('João123 Silva');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('NAME_INVALID_CHARACTERS');
    });
  });

  describe('validatePassword', () => {
    it('deve validar senha forte válida', () => {
      const result = validatePassword('MinhaSenh@123');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('MinhaSenh@123');
    });

    it('deve rejeitar senha muito curta', () => {
      const result = validatePassword('123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_TOO_SHORT')).toBe(true);
    });

    it('deve rejeitar senha sem minúscula', () => {
      const result = validatePassword('MINHASENHA123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_LOWERCASE')).toBe(true);
    });

    it('deve rejeitar senha sem maiúscula', () => {
      const result = validatePassword('minhasenha123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_UPPERCASE')).toBe(true);
    });

    it('deve rejeitar senha sem número', () => {
      const result = validatePassword('MinhaSenha!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_NUMBER')).toBe(true);
    });

    it('deve rejeitar senha sem caractere especial', () => {
      const result = validatePassword('MinhaSenha123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_SPECIAL')).toBe(true);
    });

    it('deve rejeitar senha muito comum', () => {
      const result = validatePassword('Password123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PASSWORD_TOO_COMMON')).toBe(true);
    });
  });
});