import validator from 'validator';
import { ValidationResult, ValidationError } from './types';

/**
 * Validador de CPF brasileiro
 */
export const validateCPF = (cpf: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    errors.push({
      field: 'cpf',
      message: 'CPF deve conter exatamente 11 dígitos',
      code: 'CPF_INVALID_LENGTH'
    });
    return { isValid: false, errors };
  }
  
  // Verifica se não são todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    errors.push({
      field: 'cpf',
      message: 'CPF não pode ter todos os dígitos iguais',
      code: 'CPF_INVALID_SEQUENCE'
    });
    return { isValid: false, errors };
  }
  
  // Validação do algoritmo do CPF
  let sum = 0;
  let remainder;
  
  // Primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    errors.push({
      field: 'cpf',
      message: 'CPF inválido',
      code: 'CPF_INVALID_CHECKSUM'
    });
    return { isValid: false, errors };
  }
  
  // Segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    errors.push({
      field: 'cpf',
      message: 'CPF inválido',
      code: 'CPF_INVALID_CHECKSUM'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: cleanCPF 
  };
};

/**
 * Validador de CNPJ brasileiro
 */
export const validateCNPJ = (cnpj: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) {
    errors.push({
      field: 'cnpj',
      message: 'CNPJ deve conter exatamente 14 dígitos',
      code: 'CNPJ_INVALID_LENGTH'
    });
    return { isValid: false, errors };
  }
  
  // Verifica se não são todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    errors.push({
      field: 'cnpj',
      message: 'CNPJ não pode ter todos os dígitos iguais',
      code: 'CNPJ_INVALID_SEQUENCE'
    });
    return { isValid: false, errors };
  }
  
  // Validação do algoritmo do CNPJ
  let length = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, length);
  const digits = cleanCNPJ.substring(length);
  let sum = 0;
  let pos = length - 7;
  
  // Primeiro dígito verificador
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    errors.push({
      field: 'cnpj',
      message: 'CNPJ inválido',
      code: 'CNPJ_INVALID_CHECKSUM'
    });
    return { isValid: false, errors };
  }
  
  // Segundo dígito verificador
  length = length + 1;
  numbers = cleanCNPJ.substring(0, length);
  sum = 0;
  pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    errors.push({
      field: 'cnpj',
      message: 'CNPJ inválido',
      code: 'CNPJ_INVALID_CHECKSUM'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: cleanCNPJ 
  };
};

/**
 * Validador de email
 */
export const validateEmail = (email: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push({
      field: 'email',
      message: 'Email é obrigatório',
      code: 'EMAIL_REQUIRED'
    });
    return { isValid: false, errors };
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!validator.isEmail(trimmedEmail)) {
    errors.push({
      field: 'email',
      message: 'Email deve ter um formato válido',
      code: 'EMAIL_INVALID_FORMAT'
    });
    return { isValid: false, errors };
  }
  
  // Verifica comprimento máximo
  if (trimmedEmail.length > 254) {
    errors.push({
      field: 'email',
      message: 'Email não pode ter mais de 254 caracteres',
      code: 'EMAIL_TOO_LONG'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: trimmedEmail 
  };
};

/**
 * Validador de telefone brasileiro
 */
export const validatePhone = (phone: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!phone || phone.trim().length === 0) {
    return { isValid: true, errors: [], sanitizedValue: '' }; // Telefone é opcional
  }
  
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Verifica se tem 10 ou 11 dígitos (com DDD)
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    errors.push({
      field: 'telefone',
      message: 'Telefone deve ter 10 ou 11 dígitos (incluindo DDD)',
      code: 'PHONE_INVALID_LENGTH'
    });
    return { isValid: false, errors };
  }
  
  // Verifica se o DDD é válido (11 a 99)
  const ddd = parseInt(cleanPhone.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    errors.push({
      field: 'telefone',
      message: 'DDD inválido',
      code: 'PHONE_INVALID_DDD'
    });
    return { isValid: false, errors };
  }
  
  // Para celular (11 dígitos), o primeiro dígito após o DDD deve ser 9
  if (cleanPhone.length === 11 && cleanPhone.charAt(2) !== '9') {
    errors.push({
      field: 'telefone',
      message: 'Número de celular deve começar com 9 após o DDD',
      code: 'PHONE_INVALID_MOBILE_FORMAT'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: cleanPhone 
  };
};

/**
 * Validador de valores monetários
 */
export const validateCurrency = (value: string | number, fieldName: string = 'valor'): ValidationResult => {
  const errors: ValidationError[] = [];
  
  let numericValue: number;
  
  if (typeof value === 'string') {
    // Remove caracteres não numéricos exceto ponto e vírgula
    let cleanValue = value.replace(/[^\d.,]/g, '');
    
    // Se tem ponto e vírgula, assume formato brasileiro (1.000,50)
    if (cleanValue.includes('.') && cleanValue.includes(',')) {
      // Remove pontos (separadores de milhares) e converte vírgula para ponto
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else if (cleanValue.includes(',')) {
      // Apenas vírgula, converte para ponto
      cleanValue = cleanValue.replace(',', '.');
    }
    
    numericValue = parseFloat(cleanValue);
  } else {
    numericValue = value;
  }
  
  if (isNaN(numericValue)) {
    errors.push({
      field: fieldName,
      message: 'Valor deve ser um número válido',
      code: 'CURRENCY_INVALID_FORMAT'
    });
    return { isValid: false, errors };
  }
  
  if (numericValue < 0) {
    errors.push({
      field: fieldName,
      message: 'Valor não pode ser negativo',
      code: 'CURRENCY_NEGATIVE'
    });
    return { isValid: false, errors };
  }
  
  // Verifica se tem no máximo 2 casas decimais
  const decimalPlaces = (numericValue.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push({
      field: fieldName,
      message: 'Valor não pode ter mais de 2 casas decimais',
      code: 'CURRENCY_TOO_MANY_DECIMALS'
    });
    return { isValid: false, errors };
  }
  
  // Verifica valor máximo (1 bilhão)
  if (numericValue > 1000000000) {
    errors.push({
      field: fieldName,
      message: 'Valor não pode ser maior que R$ 1.000.000.000,00',
      code: 'CURRENCY_TOO_LARGE'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: Math.round(numericValue * 100) / 100 // Arredonda para 2 casas decimais
  };
};

/**
 * Validador de número de cartão de crédito
 */
export const validateCardNumber = (cardNumber: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Remove espaços e caracteres não numéricos
  const cleanCardNumber = cardNumber.replace(/\D/g, '');
  
  if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
    errors.push({
      field: 'numero_cartao',
      message: 'Número do cartão deve ter entre 13 e 19 dígitos',
      code: 'CARD_NUMBER_INVALID_LENGTH'
    });
    return { isValid: false, errors };
  }
  
  // Algoritmo de Luhn para validação
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanCardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanCardNumber.charAt(i));
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  if (sum % 10 !== 0) {
    errors.push({
      field: 'numero_cartao',
      message: 'Número do cartão inválido',
      code: 'CARD_NUMBER_INVALID_CHECKSUM'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: cleanCardNumber 
  };
};

/**
 * Validador de CVV
 */
export const validateCVV = (cvv: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  const cleanCVV = cvv.replace(/\D/g, '');
  
  if (cleanCVV.length < 3 || cleanCVV.length > 4) {
    errors.push({
      field: 'cvv',
      message: 'CVV deve ter 3 ou 4 dígitos',
      code: 'CVV_INVALID_LENGTH'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: cleanCVV 
  };
};

/**
 * Validador de nome completo
 */
export const validateFullName = (name: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push({
      field: 'nome',
      message: 'Nome é obrigatório',
      code: 'NAME_REQUIRED'
    });
    return { isValid: false, errors };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    errors.push({
      field: 'nome',
      message: 'Nome deve ter pelo menos 2 caracteres',
      code: 'NAME_TOO_SHORT'
    });
    return { isValid: false, errors };
  }
  
  if (trimmedName.length > 100) {
    errors.push({
      field: 'nome',
      message: 'Nome não pode ter mais de 100 caracteres',
      code: 'NAME_TOO_LONG'
    });
    return { isValid: false, errors };
  }
  
  // Verifica se contém apenas letras, espaços, acentos e hífens
  if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(trimmedName)) {
    errors.push({
      field: 'nome',
      message: 'Nome deve conter apenas letras, espaços e hífens',
      code: 'NAME_INVALID_CHARACTERS'
    });
    return { isValid: false, errors };
  }
  
  // Verifica se tem pelo menos um sobrenome
  const nameParts = trimmedName.split(' ').filter(part => part.length > 0);
  if (nameParts.length < 2) {
    errors.push({
      field: 'nome',
      message: 'Nome deve incluir pelo menos um sobrenome',
      code: 'NAME_MISSING_SURNAME'
    });
    return { isValid: false, errors };
  }
  
  return { 
    isValid: true, 
    errors: [], 
    sanitizedValue: trimmedName 
  };
};

/**
 * Validador de senha forte
 */
export const validatePassword = (password: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!password || password.length === 0) {
    errors.push({
      field: 'senha',
      message: 'Senha é obrigatória',
      code: 'PASSWORD_REQUIRED'
    });
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push({
      field: 'senha',
      message: 'Senha deve ter pelo menos 8 caracteres',
      code: 'PASSWORD_TOO_SHORT'
    });
  }
  
  if (password.length > 128) {
    errors.push({
      field: 'senha',
      message: 'Senha não pode ter mais de 128 caracteres',
      code: 'PASSWORD_TOO_LONG'
    });
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push({
      field: 'senha',
      message: 'Senha deve conter pelo menos uma letra minúscula',
      code: 'PASSWORD_MISSING_LOWERCASE'
    });
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push({
      field: 'senha',
      message: 'Senha deve conter pelo menos uma letra maiúscula',
      code: 'PASSWORD_MISSING_UPPERCASE'
    });
  }
  
  if (!/\d/.test(password)) {
    errors.push({
      field: 'senha',
      message: 'Senha deve conter pelo menos um número',
      code: 'PASSWORD_MISSING_NUMBER'
    });
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push({
      field: 'senha',
      message: 'Senha deve conter pelo menos um caractere especial',
      code: 'PASSWORD_MISSING_SPECIAL'
    });
  }
  
  // Verifica padrões comuns fracos
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push({
        field: 'senha',
        message: 'Senha contém padrões muito comuns',
        code: 'PASSWORD_TOO_COMMON'
      });
      break;
    }
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    sanitizedValue: password 
  };
};