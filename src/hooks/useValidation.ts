import { useState, useCallback } from 'react';
import { z } from 'zod';
import { ValidationResult, ValidationError } from '../lib/validation/types';
import { validateWithSchema, validateAsync } from '../lib/validation/schemas';
import { sanitizeObject } from '../lib/validation/sanitizers';

interface UseValidationOptions {
  sanitize?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
}

interface UseValidationReturn<T> {
  errors: Record<string, string>;
  isValid: boolean;
  isValidating: boolean;
  validate: (data: unknown) => Promise<{ isValid: boolean; data?: T; errors?: ValidationError[] }>;
  validateField: (field: string, value: any) => Promise<void>;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  setFieldError: (field: string, message: string) => void;
}

export function useValidation<T>(
  schema: z.ZodSchema<T>,
  options: UseValidationOptions = {}
): UseValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const { sanitize = true, validateOnChange = false, debounceMs = 300 } = options;

  const validate = useCallback(async (data: unknown) => {
    setIsValidating(true);
    
    try {
      let processedData = data;
      
      if (sanitize && typeof data === 'object' && data !== null) {
        processedData = sanitizeObject(data);
      }

      const result = validateWithSchema(schema, processedData);
      
      if (result.success) {
        setErrors({});
        return { isValid: true, data: result.data };
      } else {
        const errorMap: Record<string, string> = {};
        result.errors?.forEach(error => {
          const [field, message] = error.split(': ');
          errorMap[field] = message;
        });
        setErrors(errorMap);
        return { isValid: false, errors: result.errors?.map(err => {
          const [field, message] = err.split(': ');
          return { field, message, code: 'VALIDATION_ERROR' };
        }) };
      }
    } catch (error) {
      console.error('Erro durante validação:', error);
      return { 
        isValid: false, 
        errors: [{ field: 'general', message: 'Erro interno de validação', code: 'INTERNAL_ERROR' }] 
      };
    } finally {
      setIsValidating(false);
    }
  }, [schema, sanitize]);

  const validateField = useCallback(async (field: string, value: any) => {
    if (!validateOnChange) return;

    try {
      // Cria um objeto temporário apenas com o campo sendo validado
      const tempData = { [field]: value };
      const result = await validate(tempData);
      
      if (!result.isValid && result.errors) {
        const fieldError = result.errors.find(err => err.field === field);
        if (fieldError) {
          setErrors(prev => ({ ...prev, [field]: fieldError.message }));
        }
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } catch (error) {
      console.error('Erro durante validação de campo:', error);
    }
  }, [validate, validateOnChange]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    errors,
    isValid,
    isValidating,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    setFieldError
  };
}

// Hook específico para validação de formulários
export function useFormValidation<T>(
  schema: z.ZodSchema<T>,
  initialData: Partial<T> = {},
  options: UseValidationOptions = {}
) {
  const [formData, setFormData] = useState<Partial<T>>(initialData);
  const validation = useValidation(schema, options);

  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (options.validateOnChange) {
      validation.validateField(field as string, value);
    }
  }, [validation, options.validateOnChange]);

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialData);
    validation.clearErrors();
  }, [initialData, validation]);

  const submitForm = useCallback(async () => {
    const result = await validation.validate(formData);
    return result;
  }, [validation, formData]);

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    submitForm,
    ...validation
  };
}