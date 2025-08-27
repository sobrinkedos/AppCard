# Guia do Sistema de Criptografia

## Visão Geral

O sistema de criptografia implementado fornece proteção automática para dados sensíveis, incluindo criptografia AES-256, mascaramento de dados e auditoria de acesso. Este guia explica como usar e configurar o sistema.

## Componentes Principais

### 1. EncryptionService
Serviço principal de criptografia que implementa:
- Criptografia AES-256-CBC (fallback do GCM)
- Rotação automática de chaves
- Suporte a múltiplas versões de chave
- Criptografia/descriptografia de campos individuais ou múltiplos

### 2. DataProtectionService
Serviço de proteção de dados que oferece:
- Mascaramento automático de dados sensíveis
- Controle de acesso baseado em permissões
- Auditoria de acesso a dados
- Configuração flexível de proteção

### 3. EncryptedDataService
Serviço de banco de dados que automatiza:
- Criptografia antes de salvar no banco
- Descriptografia ao recuperar dados
- Integração transparente com Supabase
- Logs de auditoria automáticos

## Como Usar

### Criptografia Básica

```typescript
import { encryptionService } from '../lib/encryption/encryptionService';

// Criptografar dados
const dadosSensiveis = "12345678901";
const encrypted = encryptionService.encrypt(dadosSensiveis);

// Descriptografar dados
const decrypted = encryptionService.decrypt(encrypted);
```

### Proteção de Dados com Mascaramento

```typescript
import { dataProtectionService } from '../lib/encryption/dataProtection';

const clienteData = {
  nome: 'João Silva',
  cpf: '12345678901',
  email: 'joao@exemplo.com'
};

const sensitiveFields = [
  { field: 'cpf', type: 'cpf' as const },
  { field: 'email', type: 'email' as const }
];

// Proteger dados (criptografar + mascarar)
const protectedData = dataProtectionService.protectSensitiveFields(
  clienteData, 
  sensitiveFields
);

// Desproteger dados (com controle de permissão)
const unprotectedData = dataProtectionService.unprotectSensitiveFields(
  protectedData,
  ['cpf', 'email'],
  userHasPermission // boolean
);
```

### Operações de Banco de Dados Criptografadas

```typescript
import { useEncryptedClientes } from '../hooks/useEncryptedData';

function ClienteComponent() {
  const {
    createCliente,
    getClientes,
    updateCliente,
    loading,
    error
  } = useEncryptedClientes();

  // Criar cliente (dados são automaticamente criptografados)
  const handleCreate = async (clienteData) => {
    const { data, error } = await createCliente(clienteData);
    if (!error) {
      console.log('Cliente criado:', data);
    }
  };

  // Buscar clientes (dados são automaticamente descriptografados)
  const handleFetch = async () => {
    const { data, error } = await getClientes(userHasPermission);
    if (!error) {
      console.log('Clientes:', data);
    }
  };
}
```

### Componentes de Interface com Mascaramento

```typescript
import { MaskedCPF, MaskedPhone, MaskedEmail } from '../components/MaskedData';

function ClienteList({ clientes, user }) {
  return (
    <div>
      {clientes.map(cliente => (
        <div key={cliente.id}>
          <h3>{cliente.nome}</h3>
          <MaskedCPF 
            data={cliente.cpf}
            canReveal={true}
            userId={user?.id}
            recordId={cliente.id}
            showCopyButton={true}
          />
          <MaskedEmail 
            data={cliente.email}
            canReveal={true}
            userId={user?.id}
            recordId={cliente.id}
          />
        </div>
      ))}
    </div>
  );
}
```

## Configuração

### Campos Sensíveis por Tabela

```typescript
import { encryptedDataService } from '../lib/database/encryptedDataService';

// Configurar campos sensíveis para uma tabela
encryptedDataService.updateSensitiveFieldsConfig('cartoes', [
  { field: 'numero', type: 'card' },
  { field: 'cvv', type: 'cvv' }
]);
```

### Rotação de Chaves

```typescript
import { keyRotationService } from '../lib/encryption/keyRotation';

// Iniciar rotação automática (a cada 90 dias)
keyRotationService.startAutoRotation(90);

// Forçar rotação imediata
await keyRotationService.forceKeyRotation();

// Verificar saúde das chaves
const health = keyRotationService.checkKeyHealth();
console.log('Status das chaves:', health.status);
```

## Tipos de Mascaramento Suportados

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `cpf` | CPF brasileiro | `***.***.***-12` |
| `cnpj` | CNPJ brasileiro | `**.***.***/****-12` |
| `phone` | Telefone | `(11) *****-**88` |
| `email` | Email | `j***@exemplo.com` |
| `card` | Número de cartão | `****-****-****-1234` |
| `cvv` | CVV do cartão | `***` |
| `generic` | Genérico | `ab***fg` |

## Auditoria e Compliance

### Logs de Acesso

O sistema registra automaticamente:
- Visualização de dados sensíveis
- Descriptografia de campos
- Exportação/cópia de dados
- IP, user agent e timestamp

### Consultar Logs

```typescript
import { dataProtectionService } from '../lib/encryption/dataProtection';

// Obter logs de auditoria
const logs = dataProtectionService.getAuditLogs({
  userId: 'user123',
  dataType: 'cpf',
  action: 'decrypt',
  startDate: new Date('2024-01-01'),
  endDate: new Date()
});

// Limpar logs antigos
dataProtectionService.cleanupAuditLogs(90); // manter 90 dias
```

## Migração de Dados Existentes

Para migrar dados não criptografados para o formato criptografado:

```typescript
import { encryptedDataService } from '../lib/database/encryptedDataService';

// Dry run (simulação)
const result = await encryptedDataService.migrateExistingData('clientes', {
  dryRun: true,
  batchSize: 100
});

console.log(`Seriam migrados ${result.migrated} registros`);

// Migração real
const realResult = await encryptedDataService.migrateExistingData('clientes', {
  dryRun: false,
  batchSize: 100,
  userId: 'admin-user-id'
});
```

## Variáveis de Ambiente

```env
# Chave mestra de criptografia (32 bytes em hex)
VITE_ENCRYPTION_MASTER_KEY=your-32-byte-hex-key-here

# Configurações de rotação
VITE_KEY_ROTATION_DAYS=90
```

## Boas Práticas

### Segurança
1. **Nunca** armazene chaves de criptografia no código
2. Use variáveis de ambiente seguras para chaves
3. Implemente rotação regular de chaves
4. Monitore logs de acesso para atividades suspeitas
5. Use HTTPS em produção

### Performance
1. Cache dados descriptografados quando apropriado
2. Use paginação para grandes datasets
3. Processe migrações em lotes pequenos
4. Monitore performance das operações criptográficas

### Compliance
1. Mantenha logs de auditoria por tempo adequado
2. Implemente controles de acesso granulares
3. Documente políticas de retenção de dados
4. Realize auditorias regulares do sistema

## Troubleshooting

### Problemas Comuns

**Erro: "Chave não encontrada"**
- Verifique se a chave de criptografia está configurada
- Confirme se a versão da chave existe

**Erro: "Dados criptografados inválidos"**
- Verifique se os dados não foram corrompidos
- Confirme se a chave correta está sendo usada

**Performance lenta**
- Considere usar cache para dados frequentemente acessados
- Otimize queries do banco de dados
- Verifique se a rotação de chaves não está impactando

### Logs de Debug

```typescript
// Habilitar logs detalhados (apenas desenvolvimento)
localStorage.setItem('encryption_debug', 'true');
```

## Suporte

Para dúvidas ou problemas:
1. Consulte os testes unitários para exemplos de uso
2. Verifique os logs de auditoria para rastrear problemas
3. Use a página de demonstração de segurança para testes