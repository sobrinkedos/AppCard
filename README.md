# 💳 Sistema de Cartão de Crédito SaaS

Um sistema completo de gestão de cartões de crédito com foco em segurança, auditoria e compliance.

## 🚀 Funcionalidades Principais

### 🔒 Sistema de Segurança Avançado
- **Criptografia AES-256** com rotação automática de chaves
- **Mascaramento de dados sensíveis** (CPF, telefone, email, cartões)
- **Controle de acesso granular** com permissões por usuário
- **Proteção de dados** em conformidade com LGPD

### 🛡️ Sistema de Auditoria Completo
- **Dashboard interativo** com métricas em tempo real
- **Alertas automáticos** para atividades suspeitas
- **Análise de tendências** e detecção de anomalias
- **Relatórios de compliance** automáticos
- **Logs detalhados** de todas as operações

### 📊 Gestão de Clientes e Cartões
- **Cadastro completo** de clientes com validação robusta
- **Emissão e gestão** de cartões de crédito
- **Controle de limites** e análise de risco
- **Histórico de transações** detalhado

### 💰 Sistema Financeiro
- **Processamento de pagamentos** seguro
- **Gestão de faturas** automatizada
- **Cobrança inteligente** com múltiplos canais
- **Relatórios financeiros** completos

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18** com TypeScript
- **Tailwind CSS** para estilização
- **Vite** como bundler
- **React Router** para navegação
- **ECharts** para gráficos interativos
- **Lucide React** para ícones

### Backend
- **Supabase** como BaaS (Backend as a Service)
- **PostgreSQL** com funções avançadas
- **Row Level Security (RLS)** para segurança
- **Real-time subscriptions** para atualizações em tempo real

### Segurança
- **Crypto-js** para criptografia
- **Validação robusta** de dados de entrada
- **Sanitização** automática de inputs
- **Auditoria completa** de todas as operações

### Testes
- **Vitest** para testes unitários
- **105+ testes** implementados
- **Cobertura completa** de validação e criptografia

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React reutilizáveis
│   ├── ClienteFormModal.tsx
│   ├── MaskedData.tsx
│   └── ValidatedInput.tsx
├── hooks/              # Hooks customizados
│   ├── useValidation.ts
│   └── useEncryptedData.ts
├── lib/                # Bibliotecas e utilitários
│   ├── audit/          # Sistema de auditoria
│   ├── encryption/     # Sistema de criptografia
│   ├── validation/     # Sistema de validação
│   └── database/       # Operações de banco
├── pages/              # Páginas da aplicação
│   ├── AuditoriaDashboard.tsx
│   ├── SecurityDemo.tsx
│   └── Clientes.tsx
└── types/              # Definições de tipos TypeScript

supabase/
└── migrations/         # Migrações do banco de dados
    ├── 20250826000001_create_enhanced_audit_system.sql
    ├── 20250826000002_add_encryption_support.sql
    └── 20250826000003_enhance_audit_functions.sql

docs/
├── ENCRYPTION_GUIDE.md    # Guia do sistema de criptografia
└── AUDIT_SYSTEM_GUIDE.md  # Guia do sistema de auditoria
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta no Supabase

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/SEU_USUARIO/AppCard.git
cd AppCard
```

2. Instale as dependências:
```bash
npm install --legacy-peer-deps
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local` com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_ENCRYPTION_MASTER_KEY=sua_chave_de_criptografia_32_bytes
```

4. Execute as migrações do banco:
```bash
# No painel do Supabase, execute os arquivos SQL em supabase/migrations/
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

6. Acesse a aplicação:
```
http://localhost:5173
```

## 🧪 Executar Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes de cobertura
npm run test:coverage
```

## 📊 Funcionalidades de Segurança

### Criptografia
- **AES-256-CBC** para dados sensíveis
- **Rotação automática** de chaves
- **Mascaramento** de dados na interface
- **Controle de acesso** baseado em permissões

### Auditoria
- **Logs detalhados** de todas as operações
- **Alertas em tempo real** para atividades suspeitas
- **Dashboard interativo** com métricas
- **Relatórios de compliance** automáticos

### Validação
- **Validação robusta** de CPF, CNPJ, email, telefone
- **Sanitização automática** de inputs
- **Validação de cartões** de crédito
- **Controle de limites** e valores

## 📈 Métricas e Monitoramento

- **105+ testes unitários** implementados
- **Cobertura de código** completa
- **Monitoramento em tempo real** de atividades
- **Alertas automáticos** para anomalias
- **Relatórios de performance** detalhados

## 🔐 Compliance e Segurança

- **LGPD** - Conformidade com Lei Geral de Proteção de Dados
- **PCI DSS** - Padrões de segurança para cartões
- **Auditoria completa** de todas as operações
- **Criptografia de ponta a ponta** para dados sensíveis
- **Controle de acesso** granular

## 📚 Documentação

- [Guia de Criptografia](docs/ENCRYPTION_GUIDE.md)
- [Guia de Auditoria](docs/AUDIT_SYSTEM_GUIDE.md)
- [Especificações do Sistema](.kiro/specs/sistema-cartao-credito-saas/)

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

- **Desenvolvedor Principal** - [Seu Nome](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- Supabase pela excelente plataforma BaaS
- React team pelo framework incrível
- Tailwind CSS pela estilização eficiente
- Comunidade open source pelas bibliotecas utilizadas

---

⭐ **Se este projeto foi útil para você, considere dar uma estrela!** ⭐