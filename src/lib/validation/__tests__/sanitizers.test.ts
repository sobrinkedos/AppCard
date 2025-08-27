import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  sanitizeNumeric,
  sanitizeDocument,
  sanitizePhone,
  sanitizeEmail,
  sanitizeSQL,
  sanitizeObject,
  formatCPF,
  formatCNPJ,
  formatPhone,
  formatCurrency,
  maskCardNumber
} from '../sanitizers';

describe('Sanitizadores', () => {
  describe('sanitizeText', () => {
    it('deve remover tags HTML', () => {
      const result = sanitizeText('<script>alert("xss")</script>Texto limpo');
      expect(result).toBe('Texto limpo');
    });

    it('deve aplicar trim por padrão', () => {
      const result = sanitizeText('  texto com espaços  ');
      expect(result).toBe('texto com espaços');
    });

    it('deve converter para minúsculas quando solicitado', () => {
      const result = sanitizeText('TEXTO MAIÚSCULO', { toLowerCase: true });
      expect(result).toBe('texto maiúsculo');
    });

    it('deve converter para maiúsculas quando solicitado', () => {
      const result = sanitizeText('texto minúsculo', { toUpperCase: true });
      expect(result).toBe('TEXTO MINÚSCULO');
    });

    it('deve remover caracteres especiais quando solicitado', () => {
      const result = sanitizeText('texto!@#$%com^&*()especiais', { removeSpecialChars: true });
      expect(result).toBe('textocomespeciais');
    });

    it('deve limitar o comprimento quando solicitado', () => {
      const result = sanitizeText('texto muito longo', { maxLength: 5 });
      expect(result).toBe('texto');
    });

    it('deve permitir apenas caracteres específicos', () => {
      const result = sanitizeText('abc123!@#', { allowedChars: 'abc123' });
      expect(result).toBe('abc123');
    });
  });

  describe('sanitizeNumeric', () => {
    it('deve manter apenas dígitos, pontos e vírgulas', () => {
      const result = sanitizeNumeric('R$ 1.234,56');
      expect(result).toBe('1.234,56');
    });

    it('deve converter número para string', () => {
      const result = sanitizeNumeric(1234.56);
      expect(result).toBe('1234.56');
    });

    it('deve retornar string vazia para entrada inválida', () => {
      const result = sanitizeNumeric(null as any);
      expect(result).toBe('');
    });
  });

  describe('sanitizeDocument', () => {
    it('deve remover formatação de CPF', () => {
      const result = sanitizeDocument('123.456.789-01');
      expect(result).toBe('12345678901');
    });

    it('deve remover formatação de CNPJ', () => {
      const result = sanitizeDocument('12.345.678/0001-90');
      expect(result).toBe('12345678000190');
    });

    it('deve retornar string vazia para entrada inválida', () => {
      const result = sanitizeDocument(null as any);
      expect(result).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('deve remover formatação de telefone', () => {
      const result = sanitizePhone('(11) 99999-8888');
      expect(result).toBe('11999998888');
    });

    it('deve manter apenas dígitos', () => {
      const result = sanitizePhone('+55 11 99999-8888');
      expect(result).toBe('5511999998888');
    });
  });

  describe('sanitizeEmail', () => {
    it('deve normalizar email', () => {
      const result = sanitizeEmail('  TESTE@EXEMPLO.COM  ');
      expect(result).toBe('teste@exemplo.com');
    });

    it('deve limitar comprimento do email', () => {
      const longEmail = 'a'.repeat(300) + '@exemplo.com';
      const result = sanitizeEmail(longEmail);
      expect(result.length).toBeLessThanOrEqual(254);
    });
  });

  describe('sanitizeSQL', () => {
    it('deve remover caracteres perigosos para SQL', () => {
      const result = sanitizeSQL("'; DROP TABLE users; --");
      expect(result).toBe('  TABLE users ');
    });

    it('deve remover comandos SQL perigosos', () => {
      const result = sanitizeSQL('SELECT * FROM users WHERE id = 1');
      expect(result).toBe(' * FROM users WHERE id = 1');
    });
  });

  describe('sanitizeObject', () => {
    it('deve sanitizar objeto recursivamente', () => {
      const obj = {
        nome: '  João  ',
        dados: {
          email: '  TESTE@EXEMPLO.COM  '
        },
        lista: ['  item1  ', '  item2  ']
      };

      const result = sanitizeObject(obj, { trim: true, toLowerCase: true });
      
      expect(result.nome).toBe('joão');
      expect(result.dados.email).toBe('teste@exemplo.com');
      expect(result.lista[0]).toBe('item1');
      expect(result.lista[1]).toBe('item2');
    });

    it('deve manter tipos primitivos', () => {
      const obj = {
        numero: 123,
        booleano: true,
        nulo: null,
        indefinido: undefined
      };

      const result = sanitizeObject(obj);
      
      expect(result.numero).toBe(123);
      expect(result.booleano).toBe(true);
      expect(result.nulo).toBe(null);
      expect(result.indefinido).toBe(undefined);
    });
  });

  describe('Formatadores', () => {
    describe('formatCPF', () => {
      it('deve formatar CPF válido', () => {
        const result = formatCPF('12345678901');
        expect(result).toBe('123.456.789-01');
      });

      it('deve retornar entrada original se inválida', () => {
        const result = formatCPF('123456789');
        expect(result).toBe('123456789');
      });
    });

    describe('formatCNPJ', () => {
      it('deve formatar CNPJ válido', () => {
        const result = formatCNPJ('12345678000190');
        expect(result).toBe('12.345.678/0001-90');
      });

      it('deve retornar entrada original se inválida', () => {
        const result = formatCNPJ('123456789');
        expect(result).toBe('123456789');
      });
    });

    describe('formatPhone', () => {
      it('deve formatar telefone fixo', () => {
        const result = formatPhone('1133334444');
        expect(result).toBe('(11) 3333-4444');
      });

      it('deve formatar celular', () => {
        const result = formatPhone('11999998888');
        expect(result).toBe('(11) 99999-8888');
      });

      it('deve retornar entrada original se inválida', () => {
        const result = formatPhone('123');
        expect(result).toBe('123');
      });
    });

    describe('formatCurrency', () => {
      it('deve formatar valor monetário', () => {
        const result = formatCurrency(1234.56);
        expect(result).toMatch(/R\$\s*1\.234,56/);
      });

      it('deve formatar valor inteiro', () => {
        const result = formatCurrency(1000);
        expect(result).toMatch(/R\$\s*1\.000,00/);
      });
    });

    describe('maskCardNumber', () => {
      it('deve mascarar número de cartão', () => {
        const result = maskCardNumber('1234567890123456');
        expect(result).toBe('**** **** **** 3456');
      });

      it('deve retornar entrada original se muito curta', () => {
        const result = maskCardNumber('123');
        expect(result).toBe('123');
      });
    });
  });
});