import DOMPurify from 'dompurify';
import { SanitizationOptions } from './types';

/**
 * Sanitiza entrada de texto para prevenir XSS
 */
export const sanitizeText = (input: string, options: SanitizationOptions = {}): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Remove tags HTML e scripts maliciosos
  sanitized = DOMPurify.sanitize(sanitized, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  });
  
  // Aplica opções de sanitização
  if (options.trim !== false) {
    sanitized = sanitized.trim();
  }
  
  if (options.toLowerCase) {
    sanitized = sanitized.toLowerCase();
  }
  
  if (options.toUpperCase) {
    sanitized = sanitized.toUpperCase();
  }
  
  if (options.removeSpecialChars) {
    sanitized = sanitized.replace(/[^\w\sÀ-ÿ]/gi, '');
  }
  
  if (options.allowedChars) {
    const regex = new RegExp(`[^${options.allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
    sanitized = sanitized.replace(regex, '');
  }
  
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  return sanitized;
};

/**
 * Sanitiza entrada numérica
 */
export const sanitizeNumeric = (input: string | number): string => {
  if (typeof input === 'number') {
    return input.toString();
  }
  
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove tudo exceto dígitos, ponto e vírgula
  return input.replace(/[^\d.,]/g, '');
};

/**
 * Sanitiza CPF/CNPJ removendo formatação
 */
export const sanitizeDocument = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove tudo exceto dígitos
  return input.replace(/\D/g, '');
};

/**
 * Sanitiza telefone removendo formatação
 */
export const sanitizePhone = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove tudo exceto dígitos
  return input.replace(/\D/g, '');
};

/**
 * Sanitiza email
 */
export const sanitizeEmail = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return sanitizeText(input, { 
    trim: true, 
    toLowerCase: true,
    maxLength: 254 
  });
};

/**
 * Sanitiza entrada SQL para prevenir SQL injection
 */
export const sanitizeSQL = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove caracteres perigosos para SQL
  return input
    .replace(/['";\\]/g, '') // Remove aspas e barras
    .replace(/--/g, '') // Remove comentários SQL
    .replace(/\/\*/g, '') // Remove início de comentário de bloco
    .replace(/\*\//g, '') // Remove fim de comentário de bloco
    .replace(/xp_/gi, '') // Remove procedimentos estendidos
    .replace(/sp_/gi, '') // Remove procedimentos do sistema
    .replace(/exec/gi, '') // Remove comando exec
    .replace(/execute/gi, '') // Remove comando execute
    .replace(/select/gi, '') // Remove comando select
    .replace(/insert/gi, '') // Remove comando insert
    .replace(/update/gi, '') // Remove comando update
    .replace(/delete/gi, '') // Remove comando delete
    .replace(/drop/gi, '') // Remove comando drop
    .replace(/create/gi, '') // Remove comando create
    .replace(/alter/gi, '') // Remove comando alter
    .replace(/union/gi, ''); // Remove comando union
};

/**
 * Sanitiza objeto completo recursivamente
 */
export const sanitizeObject = (obj: any, options: SanitizationOptions = {}): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj, options);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  if (typeof obj === 'object') {
    const sanitizedObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitizedObj[key] = sanitizeObject(obj[key], options);
      }
    }
    return sanitizedObj;
  }
  
  return obj;
};

/**
 * Formata CPF para exibição
 */
export const formatCPF = (cpf: string): string => {
  const clean = sanitizeDocument(cpf);
  if (clean.length !== 11) return cpf;
  
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

/**
 * Formata CNPJ para exibição
 */
export const formatCNPJ = (cnpj: string): string => {
  const clean = sanitizeDocument(cnpj);
  if (clean.length !== 14) return cnpj;
  
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

/**
 * Formata telefone para exibição
 */
export const formatPhone = (phone: string): string => {
  const clean = sanitizePhone(phone);
  
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
};

/**
 * Formata valor monetário para exibição
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Mascara número de cartão para exibição segura
 */
export const maskCardNumber = (cardNumber: string): string => {
  const clean = sanitizeDocument(cardNumber);
  if (clean.length < 4) return cardNumber;
  
  const lastFour = clean.slice(-4);
  const masked = '*'.repeat(clean.length - 4) + lastFour;
  
  // Adiciona espaços a cada 4 dígitos
  return masked.replace(/(.{4})/g, '$1 ').trim();
};