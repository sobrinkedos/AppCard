-- =============================================
-- DROPPING EXISTING OBJECTS (for re-runnability)
-- =============================================
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_cobrancas();
DROP FUNCTION IF EXISTS public.get_reports_data();
DROP FUNCTION IF EXISTS public.get_portal_dashboard_data(uuid);
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.clientes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.cartoes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.transacoes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.faturas;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.membros_equipe;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.convites;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.notificacoes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.logs_auditoria;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.chamados_suporte;

DROP TABLE IF EXISTS public.transacoes CASCADE;
DROP TABLE IF EXISTS public.faturas CASCADE;
DROP TABLE IF EXISTS public.cartoes CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.membros_equipe CASCADE;
DROP TABLE IF EXISTS public.convites CASCADE;
DROP TABLE IF EXISTS public.notificacoes CASCADE;
DROP TABLE IF EXISTS public.logs_auditoria CASCADE;
DROP TABLE IF EXISTS public.chamados_suporte CASCADE;

DROP TYPE IF EXISTS public.UserRole;
DROP TYPE IF EXISTS public.CardStatus;
DROP TYPE IF EXISTS public.TransactionStatus;
DROP TYPE IF EXISTS public.InvoiceStatus;
DROP TYPE IF EXISTS public.InviteStatus;
DROP TYPE IF EXISTS public.NotificationType;
DROP TYPE IF EXISTS public.TicketStatus;

-- =============================================
-- CREATING CUSTOM TYPES (ENUMS)
-- =============================================
CREATE TYPE public.UserRole AS ENUM ('Admin', 'Operador', 'Visualizador');
CREATE TYPE public.CardStatus AS ENUM ('Ativo', 'Inativo', 'Bloqueado');
CREATE TYPE public.TransactionStatus AS ENUM ('Paga', 'Pendente', 'Atrasada', 'Cancelada');
CREATE TYPE public.InvoiceStatus AS ENUM ('Paga', 'Aberta', 'Atrasada');
CREATE TYPE public.InviteStatus AS ENUM ('Pendente', 'Aceito', 'Expirado');
CREATE TYPE public.NotificationType AS ENUM ('Cobrança', 'Cartão', 'Cliente', 'Sistema');
CREATE TYPE public.TicketStatus AS ENUM ('Aberto', 'Em Andamento', 'Resolvido');

-- =============================================
-- CREATING TABLES
-- =============================================
-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    endereco TEXT,
    limite_credito NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status CardStatus NOT NULL DEFAULT 'Ativo',
    data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Cartões
CREATE TABLE IF NOT EXISTS public.cartoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    numero_cartao VARCHAR(19) UNIQUE NOT NULL,
    cvv VARCHAR(4) NOT NULL,
    data_validade VARCHAR(5) NOT NULL,
    limite NUMERIC(10, 2) NOT NULL,
    saldo_utilizado NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status CardStatus NOT NULL DEFAULT 'Ativo',
    design VARCHAR(50) DEFAULT 'Clássico',
    data_emissao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Faturas
CREATE TABLE IF NOT EXISTS public.faturas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    competencia VARCHAR(7) NOT NULL, -- Ex: '2025-07'
    data_vencimento DATE NOT NULL,
    data_fechamento DATE NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    pagamento_minimo NUMERIC(10, 2) NOT NULL,
    status InvoiceStatus NOT NULL DEFAULT 'Aberta',
    linha_digitavel VARCHAR(255),
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS public.transacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    cartao_id uuid REFERENCES public.cartoes(id) NOT NULL,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    fatura_id uuid REFERENCES public.faturas(id) ON DELETE SET NULL,
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    categoria VARCHAR(100),
    parcela_atual INT NOT NULL DEFAULT 1,
    total_parcelas INT NOT NULL DEFAULT 1,
    status TransactionStatus NOT NULL DEFAULT 'Pendente',
    data_transacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Membros da Equipe
CREATE TABLE IF NOT EXISTS public.membros_equipe (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    cargo UserRole NOT NULL,
    status CardStatus NOT NULL DEFAULT 'Ativo',
    ultimo_acesso TIMESTAMPTZ,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Convites
CREATE TABLE IF NOT EXISTS public.convites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    status InviteStatus NOT NULL DEFAULT 'Pendente',
    limite_inicial NUMERIC(10, 2),
    data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_expiracao TIMESTAMPTZ
);

-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    tipo NotificationType NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    lida BOOLEAN NOT NULL DEFAULT false,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
    id bigserial PRIMARY KEY,
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    autor_id uuid REFERENCES public.membros_equipe(id),
    acao VARCHAR(255) NOT NULL,
    alvo_id VARCHAR(255),
    detalhes JSONB,
    ip_address INET,
    data_log TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Chamados de Suporte
CREATE TABLE IF NOT EXISTS public.chamados_suporte (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    protocolo VARCHAR(50) UNIQUE NOT NULL,
    autor_id uuid REFERENCES public.membros_equipe(id),
    assunto VARCHAR(255) NOT NULL,
    descricao TEXT,
    status TicketStatus NOT NULL DEFAULT 'Aberto',
    data_abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_resolucao TIMESTAMPTZ
);

-- =============================================
-- CREATING DATABASE FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(cartoesAtivos BIGINT, vendasMes NUMERIC, totalClientes BIGINT, taxaInadimplencia NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_faturas_vencidas INT;
    total_faturas_atrasadas INT;
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.cartoes c WHERE c.status = 'Ativo' AND c.lojista_id = auth.uid()) AS cartoesAtivos,
        COALESCE((SELECT SUM(t.valor) FROM public.transacoes t WHERE date_trunc('month', t.data_transacao) = date_trunc('month', now()) AND t.lojista_id = auth.uid()), 0) AS vendasMes,
        (SELECT COUNT(*) FROM public.clientes cl WHERE cl.lojista_id = auth.uid()) AS totalClientes,
        (
            SELECT
                CASE
                    WHEN (SELECT COUNT(*) FROM public.faturas f WHERE f.status IN ('Paga', 'Atrasada') AND f.lojista_id = auth.uid()) > 0
                    THEN
                        (
                            (SELECT COUNT(*) FROM public.faturas f_atrasada WHERE f_atrasada.status = 'Atrasada' AND f_atrasada.lojista_id = auth.uid())::NUMERIC * 100 /
                            (SELECT COUNT(*) FROM public.faturas f_total WHERE f_total.status IN ('Paga', 'Atrasada') AND f_total.lojista_id = auth.uid())
                        )
                    ELSE 0
                END
        )::NUMERIC AS taxaInadimplencia;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sales_last_6_months()
RETURNS TABLE(month TEXT, total_sales NUMERIC)
LANGUAGE sql STABLE
AS $$
    SELECT 
        to_char(gs.month, 'YYYY-MM') AS month,
        COALESCE(SUM(t.valor), 0) AS total_sales
    FROM 
        generate_series(
            date_trunc('month', now()) - interval '5 months',
            date_trunc('month', now()),
            '1 month'
        ) AS gs(month)
    LEFT JOIN 
        public.transacoes t ON date_trunc('month', t.data_transacao) = gs.month AND t.lojista_id = auth.uid()
    GROUP BY 
        gs.month
    ORDER BY 
        gs.month;
$$;

CREATE OR REPLACE FUNCTION public.get_card_status_counts()
RETURNS TABLE(status CardStatus, count BIGINT)
LANGUAGE sql STABLE
AS $$
    SELECT 
        c.status,
        COUNT(*) as count
    FROM 
        public.cartoes c
    WHERE c.lojista_id = auth.uid()
    GROUP BY 
        c.status;
$$;

CREATE OR REPLACE FUNCTION public.get_cobrancas()
RETURNS TABLE(
    id uuid,
    cliente_id uuid,
    competencia character varying,
    data_vencimento date,
    data_fechamento date,
    valor_total numeric,
    pagamento_minimo numeric,
    status InvoiceStatus,
    linha_digitavel character varying,
    data_criacao timestamp with time zone,
    clientes json,
    dias_atraso integer,
    status_cobranca text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    f.*,
    json_build_object('nome', c.nome) as clientes,
    CASE
        WHEN f.status = 'Atrasada' THEN (now()::date - f.data_vencimento)
        ELSE 0
    END as dias_atraso,
    CASE
        WHEN f.status = 'Atrasada' AND (now()::date - f.data_vencimento) > 30 THEN 'Crítica'
        WHEN f.status = 'Atrasada' THEN 'Em atraso'
        WHEN f.data_vencimento < now()::date AND f.status = 'Aberta' THEN 'Vencida'
        ELSE 'Em dia'
    END as status_cobranca
  FROM public.faturas f
  JOIN public.clientes c ON f.cliente_id = c.id
  WHERE f.status IN ('Aberta', 'Atrasada') AND f.lojista_id = auth.uid()
  ORDER BY dias_atraso DESC;
$$;

-- =============================================
-- ENABLING ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CREATING RLS POLICIES
-- =============================================
CREATE POLICY "Enable all access for authenticated users"
ON public.clientes
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.cartoes
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.transacoes
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.faturas
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.membros_equipe
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.convites
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.notificacoes
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.logs_auditoria
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Enable all access for authenticated users"
ON public.chamados_suporte
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());
