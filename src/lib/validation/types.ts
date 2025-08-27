// Tipos para o sistema de validação

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedValue?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationRule {
  field: string;
  validator: (value: any) => ValidationResult;
  required?: boolean;
}

export interface SanitizationOptions {
  trim?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
  removeSpecialChars?: boolean;
  allowedChars?: string;
  maxLength?: number;
}