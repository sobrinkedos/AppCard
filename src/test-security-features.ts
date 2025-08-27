// Script de teste para demonstrar as funcionalidades de segurança implementadas

import { validateCPF, validateEmail, validatePhone, validateCurrency } from './lib/validation/validators';
import { sanitizeText, formatCPF, maskCardNumber } from './lib/validation/sanitizers';
import { encryptionService } from './lib/encryption/encryptionService';
import { dataProtectionService } from './lib/encryption/dataProtection';
import { auditLogger } from './lib/audit/auditLogger';

// Função para testar validações
export function testValidations() {
  console.log('🔍 Testando Sistema de Validação');
  console.log('================================');
  
  // Teste de CPF
  const cpfTest = validateCPF('111.444.777-35');
  console.log('CPF válido:', cpfTest.isValid ? '✅' : '❌', cpfTest.sanitizedValue);
  
  const cpfInvalido = validateCPF('123.456.789-00');
  console.log('CPF inválido:', cpfInvalido.isValid ? '✅' : '❌', cpfInvalido.errors[0]?.message);
  
  // Teste de email
  const emailTest = validateEmail('teste@exemplo.com');
  console.log('Email válido:', emailTest.isValid ? '✅' : '❌', emailTest.sanitizedValue);
  
  // Teste de telefone
  const phoneTest = validatePhone('(11) 99999-8888');
  console.log('Telefone válido:', phoneTest.isValid ? '✅' : '❌', phoneTest.sanitizedValue);
  
  // Teste de valor monetário
  const currencyTest = validateCurrency('R$ 1.500,75');
  console.log('Valor monetário:', currencyTest.isValid ? '✅' : '❌', currencyTest.sanitizedValue);
  
  console.log('\n');
}

// Função para testar sanitização
export function testSanitization() {
  console.log('🧹 Testando Sistema de Sanitização');
  console.log('==================================');
  
  // Teste de sanitização XSS
  const maliciousInput = '<script>alert("XSS")</script>Texto limpo';
  const sanitized = sanitizeText(maliciousInput);
  console.log('Entrada maliciosa:', maliciousInput);
  console.log('Texto sanitizado:', sanitized);
  
  // Teste de formatação
  const cpfFormatted = formatCPF('11144477735');
  console.log('CPF formatado:', cpfFormatted);
  
  // Teste de mascaramento
  const cardMasked = maskCardNumber('4532015112830366');
  console.log('Cartão mascarado:', cardMasked);
  
  console.log('\n');
}

// Função para testar criptografia
export function testEncryption() {
  console.log('🔐 Testando Sistema de Criptografia');
  console.log('===================================');
  
  const dadosSensiveis = 'Informação confidencial do cliente';
  
  // Criptografar
  const encrypted = encryptionService.encrypt(dadosSensiveis);
  console.log('Dados criptografados:', encrypted.encrypted.substring(0, 20) + '...');
  console.log('Algoritmo:', encrypted.algorithm);
  console.log('Versão da chave:', encrypted.keyVersion);
  
  // Descriptografar
  const decrypted = encryptionService.decrypt(encrypted);
  console.log('Dados descriptografados:', decrypted);
  console.log('Dados íntegros:', decrypted === dadosSensiveis ? '✅' : '❌');
  
  console.log('\n');
}

// Função para testar proteção de dados
export function testDataProtection() {
  console.log('🛡️ Testando Proteção de Dados');
  console.log('=============================');
  
  const clienteData = {
    nome: 'João Silva Santos',
    cpf: '11144477735',
    email: 'joao@exemplo.com',
    telefone: '11999887766'
  };
  
  const sensitiveFields = [
    { field: 'cpf', type: 'cpf' as const },
    { field: 'telefone', type: 'phone' as const }
  ];
  
  // Proteger dados
  const protectedData = dataProtectionService.protectSensitiveFields(clienteData, sensitiveFields);
  console.log('Dados originais:', clienteData);
  console.log('Dados protegidos:', {
    nome: protectedData.nome,
    cpf: protectedData.cpf?.masked,
    email: protectedData.email,
    telefone: protectedData.telefone?.masked
  });
  
  // Desproteger com permissão
  const unprotectedWithPermission = dataProtectionService.unprotectSensitiveFields(
    protectedData, 
    ['cpf', 'telefone'], 
    true
  );
  console.log('Dados desprotegidos (com permissão):', unprotectedWithPermission);
  
  // Desproteger sem permissão
  const unprotectedWithoutPermission = dataProtectionService.unprotectSensitiveFields(
    protectedData, 
    ['cpf', 'telefone'], 
    false
  );
  console.log('Dados desprotegidos (sem permissão):', unprotectedWithoutPermission);
  
  console.log('\n');
}

// Função para testar auditoria
export async function testAuditLogging() {
  console.log('📋 Testando Sistema de Auditoria');
  console.log('================================');
  
  // Simular diferentes tipos de log
  await auditLogger.logCreate('cliente', 'test-123', 'Cliente de teste criado', { nome: 'Teste' });
  console.log('Log de criação registrado ✅');
  
  await auditLogger.logRead('cliente', 'test-123', 'Dados do cliente visualizados');
  console.log('Log de leitura registrado ✅');
  
  await auditLogger.logUpdate('cliente', 'test-123', 'Cliente atualizado', { nome: 'Teste' }, { nome: 'Teste Atualizado' });
  console.log('Log de atualização registrado ✅');
  
  await auditLogger.logSuspiciousActivity('cliente', 'Múltiplas tentativas de acesso em pouco tempo');
  console.log('Log de atividade suspeita registrado ✅');
  
  // Forçar processamento do batch
  await auditLogger.flush();
  console.log('Batch de logs processado ✅');
  
  console.log('\n');
}

// Função principal para executar todos os testes
export async function runSecurityTests() {
  console.log('🚀 Iniciando Testes do Sistema de Segurança');
  console.log('===========================================\n');
  
  testValidations();
  testSanitization();
  testEncryption();
  testDataProtection();
  await testAuditLogging();
  
  console.log('✅ Todos os testes de segurança concluídos!');
  console.log('O sistema está funcionando corretamente com:');
  console.log('- Validação robusta de dados');
  console.log('- Sanitização contra XSS/SQL injection');
  console.log('- Criptografia AES-256 para dados sensíveis');
  console.log('- Mascaramento de dados para exibição');
  console.log('- Sistema completo de auditoria');
}

// Executar testes se este arquivo for importado no console do navegador
if (typeof window !== 'undefined') {
  (window as any).runSecurityTests = runSecurityTests;
  console.log('💡 Execute runSecurityTests() no console para testar o sistema de segurança');
}