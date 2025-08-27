/*
# [CREATE CONFIGURACOES TABLE]
Esta migração cria a tabela de configurações para armazenar as configurações do sistema por lojista.

## Descrição da Query:
1. Cria a tabela `configuracoes` com todos os campos necessários
2. Adiciona políticas RLS para garantir que cada lojista só acesse suas próprias configurações
3. Habilita Row Level Security na tabela

## Metadados:
- Schema-Category: "Structure"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true

## Implicações de Segurança:
- RLS Status: Habilitado
- Policy Changes: Sim, adiciona políticas de acesso
- Auth Requirements: Acesso aos dados exigirá um usuário autenticado
*/

-- Criar tabela de configurações
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    
    -- Dados da loja
    nome_empresa VARCHAR(255),
    cnpj VARCHAR(18),
    email VARCHAR(255),
    telefone VARCHAR(20),
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(10),
    logo_url TEXT,
    
    -- Configurações de cobrança
    cobranca_automatica BOOLEAN DEFAULT true,
    dias_vencimento INTEGER DEFAULT 5,
    juros_atraso NUMERIC(5,2) DEFAULT 2.5,
    multa_atraso NUMERIC(5,2) DEFAULT 10.0,
    email_cobranca BOOLEAN DEFAULT true,
    sms_cobranca BOOLEAN DEFAULT false,
    whatsapp_cobranca BOOLEAN DEFAULT true,
    
    -- Notificações
    notificar_novas_transacoes BOOLEAN DEFAULT true,
    notificar_inadimplencia BOOLEAN DEFAULT true,
    notificar_novos_clientes BOOLEAN DEFAULT false,
    notificar_limite_credito BOOLEAN DEFAULT true,
    
    -- Design dos cartões
    design_cartao_selecionado VARCHAR(50) DEFAULT 'classico',
    cores_personalizadas JSONB,
    
    -- Metadados
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Garantir que cada lojista tenha apenas uma configuração
    UNIQUE(lojista_id)
);

-- Habilitar Row Level Security
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Política para permitir que lojistas gerenciem suas próprias configurações
DROP POLICY IF EXISTS "Allow authenticated users to manage their own settings" ON public.configuracoes;
CREATE POLICY "Allow authenticated users to manage their own settings"
ON public.configuracoes FOR ALL
USING (auth.uid() = lojista_id)
WITH CHECK (auth.uid() = lojista_id);

-- Função para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION update_configuracoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar data_atualizacao
DROP TRIGGER IF EXISTS update_configuracoes_updated_at_trigger ON public.configuracoes;
CREATE TRIGGER update_configuracoes_updated_at_trigger
    BEFORE UPDATE ON public.configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION update_configuracoes_updated_at();

-- Comentários na tabela
COMMENT ON TABLE public.configuracoes IS 'Tabela para armazenar configurações do sistema por lojista';
COMMENT ON COLUMN public.configuracoes.lojista_id IS 'ID do lojista proprietário das configurações';
COMMENT ON COLUMN public.configuracoes.cores_personalizadas IS 'JSON com configurações de cores personalizadas para cartões';