# Guia do Sistema de Auditoria Avançado

## Visão Geral

O sistema de auditoria foi expandido para incluir funcionalidades avançadas de monitoramento, alertas em tempo real, análise de padrões suspeitos e dashboard interativo. Este guia explica como usar todas as funcionalidades implementadas.

## Componentes Principais

### 1. AuditLogger (Expandido)
Sistema de logging com processamento em batch e detecção automática de padrões suspeitos.

### 2. AuditDashboard
Dashboard interativo com métricas em tempo real, análise de tendências e relatórios de compliance.

### 3. AuditAlerts
Sistema de alertas em tempo real com regras configuráveis e notificações automáticas.

### 4. Funções SQL Avançadas
Funções PostgreSQL para análise de tendências, detecção de anomalias e relatórios de compliance.

## Funcionalidades Implementadas

### Dashboard de Auditoria

```typescript
import { auditDashboard } from '../lib/audit/auditDashboard';

// Gerar métricas em tempo real
const metrics = await auditDashboard.generateRealtimeMetrics('lojista-id', 24);

// Obter logs com filtros avançados
const logs = await auditDashboard.getAuditLogs({
  start_date: '2024-01-01T00:00:00.000Z',
  end_date: '2024-01-31T23:59:59.999Z',
  action: 'CREATE',
  severity: 'HIGH',
  search: 'cliente',
  is_suspicious: true
});

// Obter estatísticas de usuários
const userStats = await auditDashboard.getUserActivityStats(
  'lojista-id',
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

// Exportar logs
const csvData = await auditDashboard.exportAuditLogs('lojista-id', filters, 'csv');
```

### Sistema de Alertas em Tempo Real

```typescript
import { auditAlerts } from '../lib/audit/auditAlerts';

// Iniciar monitoramento em tempo real
auditAlerts.startRealtimeMonitoring('lojista-id');

// Registrar callback para receber alertas
auditAlerts.onAlert('dashboard', (alert) => {
  console.log('Novo alerta:', alert);
  
  // Mostrar notificação
  if (Notification.permission === 'granted') {
    new Notification(alert.title, {
      body: alert.message,
      icon: '/favicon.ico'
    });
  }
});

// Configurar regras de alerta
auditAlerts.updateAlertRules({
  FAILED_LOGIN_ATTEMPTS: {
    threshold: 5,
    timeWindow: 15 * 60 * 1000, // 15 minutos
    severity: 'HIGH'
  }
});
```

### Análise de Tendências e Anomalias

```typescript
// Obter tendências de atividade
const trends = await auditDashboard.getActivityTrends(
  'lojista-id',
  startDate,
  endDate,
  'day' // 'hour', 'day', 'week'
);

// Detectar anomalias
const anomalies = await auditDashboard.detectAnomalies('lojista-id', 24);
```

## Regras de Alerta Configuráveis

### 1. Tentativas de Login Falhadas
```typescript
FAILED_LOGIN_ATTEMPTS: {
  threshold: 5,           // Número de tentativas
  timeWindow: 15 * 60 * 1000, // 15 minutos
  severity: 'HIGH'
}
```

### 2. Limite de Ações Excedido
```typescript
RATE_LIMIT_EXCEEDED: {
  threshold: 20,          // Número de ações
  timeWindow: 5 * 60 * 1000,  // 5 minutos
  severity: 'MEDIUM'
}
```

### 3. Acesso Fora do Horário
```typescript
OFF_HOURS_ACCESS: {
  startHour: 22,          // 22:00
  endHour: 6,             // 06:00
  severity: 'MEDIUM'
}
```

### 4. Exportação de Grande Volume
```typescript
BULK_DATA_EXPORT: {
  threshold: 1000,        // Registros
  severity: 'HIGH'
}
```

### 5. Ações Administrativas Críticas
```typescript
CRITICAL_ADMIN_ACTION: {
  actions: ['DELETE', 'SUSPEND', 'ACTIVATE'],
  resources: ['cliente', 'cartao', 'usuario'],
  severity: 'CRITICAL'
}
```

### 6. Padrões de Acesso Anômalos
```typescript
ANOMALOUS_ACCESS: {
  ipChangeThreshold: 3,   // IPs diferentes
  timeWindow: 30 * 60 * 1000, // 30 minutos
  severity: 'HIGH'
}
```

## Funções SQL Avançadas

### Tendências de Atividade
```sql
SELECT * FROM public.get_activity_trends(
  'lojista-id',
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z',
  'day'
);
```

### Detecção de Anomalias
```sql
SELECT * FROM public.detect_activity_anomalies(
  'lojista-id',
  24 -- horas
);
```

### Cálculo de Score de Risco Dinâmico
```sql
SELECT public.calculate_dynamic_risk_score(
  'lojista-id',
  'usuario-id',
  'DELETE',
  'cliente',
  '192.168.1.1'::inet
);
```

### Relatório de Compliance
```sql
SELECT * FROM public.generate_compliance_report(
  'lojista-id',
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z'
);
```

### Limpeza Inteligente de Logs
```sql
SELECT * FROM public.intelligent_log_cleanup('lojista-id');
```

## Dashboard Interativo

### Métricas Principais
- **Total de Eventos**: Número total de ações auditadas
- **Eventos Suspeitos**: Ações marcadas como suspeitas
- **Usuários Ativos**: Número de usuários únicos
- **Tempo Médio**: Performance média das operações

### Gráficos e Visualizações
- **Distribuição por Severidade**: Gráfico de pizza
- **Tendências Temporais**: Gráfico de linha
- **Atividade por Usuário**: Tabela detalhada
- **Alertas por Status**: Contadores visuais

### Filtros Avançados
- **Período**: Data de início e fim
- **Severidade**: LOW, MEDIUM, HIGH, CRITICAL
- **Ação**: CREATE, READ, UPDATE, DELETE, etc.
- **Usuário**: Filtro por usuário específico
- **Busca**: Texto livre nos logs
- **Status**: SUCCESS, FAILURE, WARNING, ERROR

## Alertas e Notificações

### Tipos de Alerta
1. **FAILED_LOGIN_ATTEMPTS**: Múltiplas tentativas de login
2. **RATE_LIMIT_EXCEEDED**: Excesso de ações
3. **OFF_HOURS_ACCESS**: Acesso fora do horário
4. **BULK_DATA_EXPORT**: Exportação em massa
5. **CRITICAL_ADMIN_ACTION**: Ações administrativas críticas
6. **ANOMALOUS_ACCESS**: Padrões de acesso suspeitos

### Status de Alerta
- **OPEN**: Alerta ativo, aguardando ação
- **INVESTIGATING**: Em investigação
- **RESOLVED**: Resolvido
- **FALSE_POSITIVE**: Falso positivo

### Ações Disponíveis
- **Investigar**: Marcar como em investigação
- **Resolver**: Marcar como resolvido
- **Falso Positivo**: Descartar alerta

## Compliance e Auditoria

### Métricas de Compliance
- **Retenção de Dados**: Verificação de políticas de retenção
- **Acesso a Dados Sensíveis**: Monitoramento de acessos
- **Eventos Suspeitos**: Análise de atividades anômalas
- **Cobertura de Auditoria**: Tipos de recursos auditados

### Relatórios Automáticos
- **Relatório Diário**: Resumo das atividades
- **Relatório Semanal**: Tendências e anomalias
- **Relatório Mensal**: Compliance e métricas
- **Relatório de Incidentes**: Eventos críticos

## Performance e Otimização

### Processamento em Batch
- Logs processados em lotes de 10 registros
- Timeout de 5 segundos para processamento
- Fallback para localStorage em caso de falha

### Índices de Banco de Dados
- Índices otimizados para consultas frequentes
- Particionamento por data para performance
- Limpeza automática de dados antigos

### Cache e Otimização
- Cache de métricas em tempo real
- Paginação eficiente para grandes datasets
- Consultas otimizadas com filtros

## Configuração e Personalização

### Configuração de Auditoria
```sql
INSERT INTO public.audit_config (
  lojista_id,
  log_level,
  log_retention_days,
  enable_alerts,
  alert_thresholds,
  compliance_mode
) VALUES (
  'lojista-id',
  'INFO',
  365,
  true,
  '{"failed_logins": 5, "rate_limit": 20}',
  true
);
```

### Personalização de Alertas
```typescript
// Atualizar thresholds
auditAlerts.updateAlertRules({
  FAILED_LOGIN_ATTEMPTS: {
    threshold: 10, // Aumentar para 10 tentativas
    timeWindow: 30 * 60 * 1000, // 30 minutos
    severity: 'CRITICAL'
  }
});
```

## Integração com Componentes React

### Hook para Dashboard
```typescript
import { useAuditDashboard } from '../hooks/useAuditDashboard';

function AuditDashboard() {
  const {
    metrics,
    logs,
    alerts,
    loading,
    error,
    refreshData,
    exportLogs
  } = useAuditDashboard();

  return (
    <div>
      {/* Dashboard UI */}
    </div>
  );
}
```

### Componente de Alertas
```typescript
import { AuditAlertsComponent } from '../components/AuditAlerts';

function SecurityPanel() {
  return (
    <div>
      <AuditAlertsComponent 
        lojistaId="lojista-id"
        onAlertAction={handleAlertAction}
      />
    </div>
  );
}
```

## Monitoramento e Manutenção

### Estatísticas do Sistema
```sql
SELECT * FROM public.get_audit_system_stats();
```

### Limpeza Automática
- Configuração de retenção por lojista
- Arquivamento de logs críticos
- Remoção de logs antigos não críticos

### Monitoramento de Performance
- Métricas de inserção de logs
- Tempo de resposta das consultas
- Uso de espaço em disco

## Troubleshooting

### Problemas Comuns

**Alertas não sendo gerados**
- Verificar se o monitoramento está ativo
- Confirmar configuração das regras
- Verificar logs de erro no console

**Performance lenta no dashboard**
- Usar filtros para reduzir dataset
- Verificar índices do banco de dados
- Considerar cache de métricas

**Logs não sendo salvos**
- Verificar conexão com banco
- Confirmar permissões RLS
- Verificar fallback no localStorage

### Logs de Debug
```typescript
// Habilitar logs detalhados
localStorage.setItem('audit_debug', 'true');

// Verificar estatísticas do sistema
const stats = await auditDashboard.getSystemStats();
console.log('Estatísticas do sistema:', stats);
```

## Segurança e Privacidade

### Proteção de Dados
- Logs de auditoria protegidos por RLS
- Criptografia de dados sensíveis nos logs
- Controle de acesso granular

### Retenção e Compliance
- Políticas configuráveis de retenção
- Arquivamento de dados críticos
- Relatórios de compliance automáticos

### Auditoria da Auditoria
- Logs de acesso ao sistema de auditoria
- Rastreamento de alterações de configuração
- Monitoramento de exportações de dados

Este sistema de auditoria avançado fornece visibilidade completa das atividades do sistema, detecção proativa de ameaças e compliance automatizado, essencial para um sistema de cartão de crédito SaaS.