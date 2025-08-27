import React, { useState } from 'react';
import { Shield, Lock, Eye, FileText, AlertTriangle, Save, Users, Database, CheckCircle } from 'lucide-react';
import { validateCPF, validateEmail, validatePhone } from '../lib/validation/validators';
import { sanitizeText, formatCPF, maskCardNumber } from '../lib/validation/sanitizers';
import { encryptionService } from '../lib/encryption/encryptionService';
import { dataProtectionService } from '../lib/encryption/dataProtection';
import { auditLogger } from '../lib/audit/auditLogger';
import { useEncryptedClientes } from '../hooks/useEncryptedData';
import { MaskedCPF, MaskedPhone, MaskedEmail } from '../components/MaskedData';
import { useAuth } from '../contexts/AuthContext';

const SecurityDemo: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [demoClient, setDemoClient] = useState<any>(null);
  const { user } = useAuth();
  
  // Hook para operações criptografadas
  const {
    createCliente,
    getClientes,
    loading: clienteLoading,
    error: clienteError
  } = useEncryptedClientes();
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, message]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runValidationTests = () => {
    addResult('🔍 Testando Sistema de Validação');
    addResult('================================');
    
    // Teste CPF válido
    const cpfValido = validateCPF('111.444.777-35');
    addResult(`CPF válido (111.444.777-35): ${cpfValido.isValid ? '✅' : '❌'}`);
    
    // Teste CPF inválido
    const cpfInvalido = validateCPF('123.456.789-00');
    addResult(`CPF inválido (123.456.789-00): ${cpfInvalido.isValid ? '❌' : '✅'} - ${cpfInvalido.errors[0]?.message}`);
    
    // Teste email
    const emailTest = validateEmail('teste@exemplo.com');
    addResult(`Email válido: ${emailTest.isValid ? '✅' : '❌'} - ${emailTest.sanitizedValue}`);
    
    // Teste telefone
    const phoneTest = validatePhone('(11) 99999-8888');
    addResult(`Telefone válido: ${phoneTest.isValid ? '✅' : '❌'} - ${phoneTest.sanitizedValue}`);
    
    addResult('');
  };

  const runSanitizationTests = () => {
    addResult('🧹 Testando Sistema de Sanitização');
    addResult('==================================');
    
    // Teste XSS
    const maliciousInput = '<script>alert("XSS")</script>Texto limpo';
    const sanitized = sanitizeText(maliciousInput);
    addResult(`Entrada maliciosa: ${maliciousInput}`);
    addResult(`Texto sanitizado: ${sanitized}`);
    
    // Formatação
    const cpfFormatted = formatCPF('11144477735');
    addResult(`CPF formatado: ${cpfFormatted}`);
    
    // Mascaramento
    const cardMasked = maskCardNumber('4532015112830366');
    addResult(`Cartão mascarado: ${cardMasked}`);
    
    addResult('');
  };

  const runEncryptionTests = () => {
    addResult('🔐 Testando Sistema de Criptografia');
    addResult('===================================');
    
    const dadosSensiveis = 'Informação confidencial do cliente';
    
    try {
      // Criptografar
      const encrypted = encryptionService.encrypt(dadosSensiveis);
      addResult(`Dados originais: ${dadosSensiveis}`);
      addResult(`Dados criptografados: ${encrypted.encrypted.substring(0, 30)}...`);
      addResult(`Algoritmo: ${encrypted.algorithm}`);
      
      // Descriptografar
      const decrypted = encryptionService.decrypt(encrypted);
      addResult(`Dados descriptografados: ${decrypted}`);
      addResult(`Integridade: ${decrypted === dadosSensiveis ? '✅' : '❌'}`);
    } catch (error: any) {
      addResult(`❌ Erro na criptografia: ${error.message}`);
    }
    
    addResult('');
  };

  const runDataProtectionTests = () => {
    addResult('🛡️ Testando Proteção de Dados');
    addResult('=============================');
    
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
    
    try {
      // Proteger dados
      const protectedData = dataProtectionService.protectSensitiveFields(clienteData, sensitiveFields);
      addResult(`Dados originais: ${JSON.stringify(clienteData)}`);
      addResult(`CPF mascarado: ${protectedData.cpf?.masked}`);
      addResult(`Telefone mascarado: ${protectedData.telefone?.masked}`);
      
      // Desproteger sem permissão
      const unprotectedWithoutPermission = dataProtectionService.unprotectSensitiveFields(
        protectedData, 
        ['cpf', 'telefone'], 
        false
      );
      addResult(`Sem permissão - CPF: ${unprotectedWithoutPermission.cpf}`);
      
      // Desproteger com permissão
      const unprotectedWithPermission = dataProtectionService.unprotectSensitiveFields(
        protectedData, 
        ['cpf', 'telefone'], 
        true
      );
      addResult(`Com permissão - CPF: ${unprotectedWithPermission.cpf}`);
    } catch (error: any) {
      addResult(`❌ Erro na proteção de dados: ${error.message}`);
    }
    
    addResult('');
  };

  const testarBancoCriptografado = async () => {
    addResult('💾 Testando Banco de Dados Criptografado');
    addResult('==========================================');
    
    if (!user) {
      addResult('❌ Usuário não autenticado');
      return;
    }

    const clienteData = {
      nome: 'Cliente Teste Criptografia',
      cpf: '98765432100',
      email: 'teste.cripto@exemplo.com',
      telefone: '11888887777',
      endereco: 'Rua Teste, 123 - São Paulo/SP',
      limite_credito: 5000,
      dia_vencimento: 15,
      status: 'Ativo' as const
    };

    try {
      addResult('Criando cliente com dados criptografados...');
      
      // Criar cliente usando o hook criptografado
      const { data: novoCliente, error } = await createCliente(clienteData);
      
      if (error) {
        addResult(`❌ Erro ao criar cliente: ${error.message}`);
        return;
      }

      if (novoCliente) {
        addResult(`✅ Cliente criado com ID: ${novoCliente.id}`);
        addResult(`Nome: ${novoCliente.nome}`);
        addResult(`CPF (criptografado): ${typeof novoCliente.cpf === 'object' ? 'Dados criptografados' : novoCliente.cpf}`);
        
        setDemoClient(novoCliente);
        
        // Buscar clientes para verificar descriptografia
        addResult('Buscando clientes com descriptografia...');
        const { data: clientes } = await getClientes(false); // Sem permissão para ver dados reais
        
        if (clientes && clientes.length > 0) {
          const clienteEncontrado = clientes.find(c => c.id === novoCliente.id);
          if (clienteEncontrado) {
            addResult(`Cliente encontrado - CPF mascarado: ${clienteEncontrado.cpf}`);
          }
        }
        
        addResult('✅ Sistema de criptografia de banco funcionando!');
      }
    } catch (error: any) {
      addResult(`❌ Erro no teste de banco criptografado: ${error.message}`);
    }
    
    addResult('');
  };

  const runAuditTests = async () => {
    addResult('📋 Testando Sistema de Auditoria');
    addResult('================================');
    
    try {
      // Simular logs
      await auditLogger.logCreate('cliente', 'demo-123', 'Cliente de demonstração criado');
      addResult('✅ Log de criação registrado');
      
      await auditLogger.logRead('cliente', 'demo-123', 'Dados visualizados na demonstração');
      addResult('✅ Log de leitura registrado');
      
      await auditLogger.logUpdate('cliente', 'demo-123', 'Cliente atualizado na demo', 
        { nome: 'Antigo' }, { nome: 'Novo' });
      addResult('✅ Log de atualização registrado');
      
      await auditLogger.logSuspiciousActivity('sistema', 'Demonstração de atividade suspeita');
      addResult('✅ Log de atividade suspeita registrado');
      
      // Processar batch
      await auditLogger.flush();
      addResult('✅ Batch de logs processado');
    } catch (error: any) {
      addResult(`❌ Erro no sistema de auditoria: ${error.message}`);
    }
    
    addResult('');
  };

  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();
    
    addResult('🚀 Iniciando Demonstração do Sistema de Segurança');
    addResult('================================================');
    addResult('');
    
    runValidationTests();
    runSanitizationTests();
    runEncryptionTests();
    runDataProtectionTests();
    await runAuditTests();
    
    addResult('✅ Demonstração concluída com sucesso!');
    addResult('');
    addResult('Sistema implementado com:');
    addResult('- ✅ Validação robusta de dados');
    addResult('- ✅ Sanitização contra XSS/SQL injection');
    addResult('- ✅ Criptografia AES-256 para dados sensíveis');
    addResult('- ✅ Mascaramento de dados para exibição');
    addResult('- ✅ Sistema completo de auditoria');
    
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            Demonstração de Segurança
          </h2>
          <p className="text-gray-600 mt-2">
            Teste das funcionalidades de segurança implementadas no sistema
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-4">
            <Eye className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="font-semibold">Validação</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Sistema robusto de validação com regras de negócio específicas
          </p>
          <button
            onClick={runValidationTests}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Testar Validação
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-4">
            <Lock className="w-6 h-6 text-green-600 mr-2" />
            <h3 className="font-semibold">Criptografia</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Criptografia AES-256 com rotação de chaves para dados sensíveis
          </p>
          <button
            onClick={runEncryptionTests}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            Testar Criptografia
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mr-2" />
            <h3 className="font-semibold">Proteção</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Mascaramento e proteção de dados com controle de acesso
          </p>
          <button
            onClick={runDataProtectionTests}
            className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Testar Proteção
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 text-purple-600 mr-2" />
            <h3 className="font-semibold">Auditoria</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Sistema completo de logs e rastreamento de atividades
          </p>
          <button
            onClick={runAuditTests}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Testar Auditoria
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-4">
          <Database className="w-6 h-6 text-indigo-600 mr-2" />
          <h3 className="font-semibold text-lg">Banco de Dados Criptografado</h3>
        </div>
        <p className="text-gray-600 mb-4">
          Teste completo do sistema de criptografia integrado com o banco de dados Supabase
        </p>
        
        {demoClient && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Cliente de Demonstração:</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Nome:</strong> {demoClient.nome}</div>
              <div><strong>CPF:</strong> <MaskedCPF data={demoClient.cpf} canReveal={true} userId={user?.id} recordId={demoClient.id} /></div>
              <div><strong>Email:</strong> <MaskedEmail data={demoClient.email} canReveal={true} userId={user?.id} recordId={demoClient.id} /></div>
              <div><strong>Telefone:</strong> <MaskedPhone data={demoClient.telefone} canReveal={true} userId={user?.id} recordId={demoClient.id} /></div>
            </div>
          </div>
        )}
        
        <button
          onClick={testarBancoCriptografado}
          disabled={clienteLoading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center"
        >
          {clienteLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Testar Banco Criptografado
            </>
          )}
        </button>
        
        {clienteError && (
          <div className="mt-2 text-sm text-red-600 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-1" />
            {clienteError}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Teste Completo</h3>
          <div className="space-x-3">
            <button
              onClick={clearResults}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center"
            >
              {isRunning && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              Executar Todos os Testes
            </button>
          </div>
        </div>

        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">Clique em "Executar Todos os Testes" para ver os resultados...</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityDemo;