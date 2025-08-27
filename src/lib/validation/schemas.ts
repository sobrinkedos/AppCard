import { z } from 'zod';
import { validateCPF, validateCNPJ, validateEmail, validatePhone, validateCurrency, validateCardNumber, validateCVV, validateFullName, validatePassword } from './validators';

// Schema personalizado para CPF
const cpfSchema = z.string().refine((val) => {
  const result = validateCPF(val);
  return result.isValid;
}, {
  message: 'CPF inválido'
});

// Schema personalizado para CNPJ
const cnpjSchema = z.string().refine((val) => {
  const result = validateCNPJ(val);
  return result.isValid;
}, {
  message: 'CNPJ inválido'
});

// Schema personalizado para email
const emailSchema = z.string().refine((val) => {
  const result = validateEmail(val);
  return result.isValid;
}, {
  message: 'Email inválido'
});

// Schema personalizado para telefone
const phoneSchema = z.string().optional().refine((val) => {
  if (!val) return true; // Telefone é opcional
  const result = validatePhone(val);
  return result.isValid;
}, {
  message: 'Telefone inválido'
});

// Schema personalizado para valores monetários
const currencySchema = z.union([z.string(), z.number()]).refine((val) => {
  const result = validateCurrency(val);
  return result.isValid;
}, {
  message: 'Valor monetário inválido'
});

// Schema personalizado para número de cartão
const cardNumberSchema = z.string().refine((val) => {
  const result = validateCardNumber(val);
  return result.isValid;
}, {
  message: 'Número de cartão inválido'
});

// Schema personalizado para CVV
const cvvSchema = z.string().refine((val) => {
  const result = validateCVV(val);
  return result.isValid;
}, {
  message: 'CVV inválido'
});

// Schema personalizado para nome completo
const fullNameSchema = z.string().refine((val) => {
  const result = validateFullName(val);
  return result.isValid;
}, {
  message: 'Nome completo inválido'
});

// Schema personalizado para senha
const passwordSchema = z.string().refine((val) => {
  const result = validatePassword(val);
  return result.isValid;
}, {
  message: 'Senha não atende aos critérios de segurança'
});

// Schema para cliente
export const clienteSchema = z.object({
  nome: fullNameSchema,
  cpf: cpfSchema,
  email: emailSchema,
  telefone: phoneSchema,
  endereco: z.string().max(500, 'Endereço não pode ter mais de 500 caracteres').optional(),
  limite_credito: currencySchema,
  dia_vencimento: z.number().min(1, 'Dia deve ser entre 1 e 31').max(31, 'Dia deve ser entre 1 e 31'),
  status: z.enum(['Ativo', 'Inativo', 'Bloqueado'])
});

// Schema para cartão
export const cartaoSchema = z.object({
  cliente_id: z.string().uuid('ID do cliente deve ser um UUID válido'),
  numero_cartao: cardNumberSchema,
  cvv: cvvSchema,
  data_validade: z.string().regex(/^\d{2}\/\d{2}$/, 'Data de validade deve estar no formato MM/AA'),
  limite: currencySchema,
  status: z.enum(['Ativo', 'Inativo', 'Bloqueado']),
  design: z.string().max(100, 'Design não pode ter mais de 100 caracteres').optional()
});

// Schema para transação
export const transacaoSchema = z.object({
  cartao_id: z.string().uuid('ID do cartão deve ser um UUID válido'),
  cliente_id: z.string().uuid('ID do cliente deve ser um UUID válido'),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(255, 'Descrição não pode ter mais de 255 caracteres'),
  valor: currencySchema.refine((val) => {
    const numVal = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    return numVal > 0;
  }, 'Valor deve ser maior que zero'),
  categoria: z.string().max(50, 'Categoria não pode ter mais de 50 caracteres').optional(),
  parcela_atual: z.number().min(1, 'Parcela atual deve ser pelo menos 1'),
  total_parcelas: z.number().min(1, 'Total de parcelas deve ser pelo menos 1'),
  status: z.enum(['Paga', 'Pendente', 'Atrasada', 'Cancelada'])
});

// Schema para fatura
export const faturaSchema = z.object({
  cliente_id: z.string().uuid('ID do cliente deve ser um UUID válido'),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência deve estar no formato AAAA-MM'),
  data_vencimento: z.string().datetime('Data de vencimento deve ser uma data válida'),
  data_fechamento: z.string().datetime('Data de fechamento deve ser uma data válida'),
  valor_total: currencySchema,
  pagamento_minimo: currencySchema,
  status: z.enum(['Paga', 'Aberta', 'Atrasada', 'Parcialmente Paga']),
  linha_digitavel: z.string().max(100, 'Linha digitável não pode ter mais de 100 caracteres').optional()
});

// Schema para membro da equipe
export const membroEquipeSchema = z.object({
  nome: fullNameSchema,
  email: emailSchema,
  cargo: z.enum(['Admin', 'Operador', 'Visualizador']),
  status: z.enum(['Ativo', 'Inativo', 'Bloqueado']),
  senha: passwordSchema.optional() // Opcional para edição
});

// Schema para convite
export const conviteSchema = z.object({
  destinatario: z.string().min(1, 'Destinatário é obrigatório'),
  tipo: z.enum(['Email', 'WhatsApp']),
  limite_inicial: currencySchema.optional(),
  data_expiracao: z.string().datetime('Data de expiração deve ser uma data válida').optional()
});

// Schema para login
export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Senha é obrigatória')
});

// Schema para alteração de senha
export const alterarSenhaSchema = z.object({
  senha_atual: z.string().min(1, 'Senha atual é obrigatória'),
  nova_senha: passwordSchema,
  confirmar_senha: z.string().min(1, 'Confirmação de senha é obrigatória')
}).refine((data) => data.nova_senha === data.confirmar_senha, {
  message: 'Senhas não coincidem',
  path: ['confirmar_senha']
});

// Schema para recuperação de senha
export const recuperarSenhaSchema = z.object({
  email: emailSchema
});

// Schema para configurações de cobrança
export const configuracaoCobrancaSchema = z.object({
  dias_vencimento: z.number().min(1, 'Dias para vencimento deve ser pelo menos 1').max(90, 'Dias para vencimento não pode ser maior que 90'),
  taxa_juros_mensal: z.number().min(0, 'Taxa de juros não pode ser negativa').max(20, 'Taxa de juros não pode ser maior que 20%'),
  multa_atraso: z.number().min(0, 'Multa não pode ser negativa').max(10, 'Multa não pode ser maior que 10%'),
  valor_minimo_fatura: currencySchema,
  percentual_pagamento_minimo: z.number().min(1, 'Percentual mínimo deve ser pelo menos 1%').max(100, 'Percentual mínimo não pode ser maior que 100%')
});

// Função utilitária para validar dados usando schemas
export const validateWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Erro de validação desconhecido'] };
  }
};

// Função para validação assíncrona (para casos que precisam verificar banco de dados)
export const validateAsync = async <T>(
  schema: z.ZodSchema<T>, 
  data: unknown,
  customValidations?: Array<(data: T) => Promise<string | null>>
): Promise<{ success: boolean; data?: T; errors?: string[] }> => {
  // Primeiro valida com o schema
  const schemaResult = validateWithSchema(schema, data);
  if (!schemaResult.success) {
    return schemaResult;
  }
  
  // Depois executa validações customizadas assíncronas
  if (customValidations && customValidations.length > 0) {
    const errors: string[] = [];
    
    for (const validation of customValidations) {
      try {
        const error = await validation(schemaResult.data!);
        if (error) {
          errors.push(error);
        }
      } catch (err) {
        errors.push('Erro durante validação customizada');
      }
    }
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
  }
  
  return schemaResult;
};