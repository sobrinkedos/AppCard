/*
  # [Operação de Correção] Adicionar Suporte Multi-Inquilino (lojista_id) e Corrigir Funções

  ## Descrição da Query:
  Este script corrige uma falha estrutural no banco de dados. Ele adiciona a coluna `lojista_id` a todas as tabelas relevantes para garantir que os dados de cada lojista sejam isolados. Além disso, recria as funções de agregação de dados (para dashboards e relatórios) para que elas filtrem os resultados com base no usuário autenticado, resolvendo o erro "column t.lojista_id does not exist".

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "High"
  - Requires-Backup: true
  - Reversible: false

  ## Detalhes da Estrutura:
  - Adiciona a coluna `lojista_id` às tabelas: clientes, cartoes, transacoes, faturas, membros_equipe, convites, notificacoes, chamados_suporte, logs_auditoria.
  - Recria as funções: get_dashboard_stats, get_reports_data, get_cobrancas, get_portal_dashboard_data, get_sales_last_6_months, get_card_status_counts.

  ## Implicações de Segurança:
  - RLS Status: Habilitado
  - Mudanças de Política: Nenhuma (prepara o terreno para políticas futuras)
  - Requisitos de Autenticação: Essencial para o funcionamento correto das funções.
*/

-- Adicionar coluna lojista_id às tabelas
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.cartoes ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.membros_equipe ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chamados_suporte ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.logs_auditoria ADD COLUMN IF NOT EXISTS lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- Corrigir e recriar funções para usar lojista_id

-- 1. get_dashboard_stats
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(cartoesAtivos bigint, vendasMes numeric, totalClientes bigint, taxaInadimplencia numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_faturas_vencidas integer;
    total_faturas_inadimplentes integer;
BEGIN
    RETURN QUERY
    SELECT
        (SELECT count(*) FROM public.cartoes WHERE status = 'Ativo' AND lojista_id = auth.uid()) AS cartoesAtivos,
        COALESCE((SELECT sum(valor) FROM public.transacoes WHERE data_transacao >= date_trunc('month', current_date) AND lojista_id = auth.uid()), 0) AS vendasMes,
        (SELECT count(*) FROM public.clientes WHERE lojista_id = auth.uid()) AS totalClientes,
        (
            SELECT
                CASE
                    WHEN (SELECT count(*) FROM public.faturas WHERE data_vencimento < current_date AND lojista_id = auth.uid()) > 0
                    THEN
                        (
                            (SELECT count(*) FROM public.faturas WHERE status = 'Atrasada' AND lojista_id = auth.uid())::numeric /
                            (SELECT count(*) FROM public.faturas WHERE data_vencimento < current_date AND lojista_id = auth.uid())::numeric
                        ) * 100
                    ELSE 0
                END
        ) AS taxaInadimplencia;
END;
$$;

-- 2. get_sales_last_6_months
DROP FUNCTION IF EXISTS public.get_sales_last_6_months();
CREATE OR REPLACE FUNCTION public.get_sales_last_6_months()
RETURNS TABLE(month text, total_sales numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        to_char(gs.month, 'YYYY-MM') AS month,
        COALESCE(sum(t.valor), 0) AS total_sales
    FROM
        generate_series(
            date_trunc('month', current_date) - interval '5 months',
            date_trunc('month', current_date),
            '1 month'
        ) AS gs(month)
    LEFT JOIN
        transacoes t ON date_trunc('month', t.data_transacao) = gs.month AND t.lojista_id = auth.uid()
    GROUP BY
        gs.month
    ORDER BY
        gs.month;
$$;

-- 3. get_card_status_counts
DROP FUNCTION IF EXISTS public.get_card_status_counts();
CREATE OR REPLACE FUNCTION public.get_card_status_counts()
RETURNS TABLE(status CardStatus, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.status,
        count(*)
    FROM
        cartoes c
    WHERE c.lojista_id = auth.uid()
    GROUP BY
        c.status;
$$;


-- 4. get_cobrancas
DROP FUNCTION IF EXISTS public.get_cobrancas();
CREATE OR REPLACE FUNCTION public.get_cobrancas()
RETURNS TABLE(
  id uuid,
  cliente_id uuid,
  competencia text,
  data_vencimento date,
  data_fechamento date,
  valor_total numeric,
  pagamento_minimo numeric,
  status InvoiceStatus,
  linha_digitavel text,
  data_criacao timestamp with time zone,
  clientes json,
  dias_atraso integer,
  status_cobranca text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.cliente_id,
        f.competencia,
        f.data_vencimento,
        f.data_fechamento,
        f.valor_total,
        f.pagamento_minimo,
        f.status,
        f.linha_digitavel,
        f.data_criacao,
        json_build_object('nome', c.nome) as clientes,
        CASE
            WHEN f.status = 'Atrasada' THEN (current_date - f.data_vencimento)
            ELSE 0
        END AS dias_atraso,
        CASE
            WHEN f.status = 'Atrasada' AND (current_date - f.data_vencimento) > 30 THEN 'Crítica'
            WHEN f.status = 'Atrasada' THEN 'Em atraso'
            WHEN f.data_vencimento < current_date and f.status = 'Aberta' THEN 'Vencida'
            ELSE 'Em dia'
        END AS status_cobranca
    FROM faturas f
    JOIN clientes c ON f.cliente_id = c.id
    WHERE f.status IN ('Aberta', 'Atrasada') AND f.lojista_id = auth.uid()
    ORDER BY dias_atraso DESC;
END;
$$;

-- 5. get_reports_data
DROP FUNCTION IF EXISTS public.get_reports_data();
CREATE OR REPLACE FUNCTION public.get_reports_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    kpis_data json;
    sales_chart_data json;
    clients_chart_data json;
    defaults_chart_data json;
BEGIN
    -- KPIs
    SELECT json_build_object(
        'receita', COALESCE(sum(valor), 0),
        'novosClientes', count(DISTINCT CASE WHEN data_cadastro >= current_date - interval '30 days' THEN id END),
        'inadimplencia', COALESCE(
            (SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN status = 'Atrasada' THEN 1 END)::numeric / COUNT(*)::numeric) * 100
                    ELSE 0 
                END 
             FROM faturas WHERE lojista_id = auth.uid()), 0),
        'cartoesAtivos', (SELECT count(*) FROM cartoes WHERE status = 'Ativo' AND lojista_id = auth.uid())
    ) INTO kpis_data
    FROM transacoes WHERE lojista_id = auth.uid();

    -- Sales Chart
    SELECT json_agg(t) INTO sales_chart_data FROM get_sales_last_6_months() t;

    -- Clients Chart
    SELECT json_agg(json_build_object('status', status, 'count', count(*))) INTO clients_chart_data FROM clientes WHERE lojista_id = auth.uid() GROUP BY status;

    -- Defaults Chart
    SELECT json_agg(sub) INTO defaults_chart_data FROM (
      SELECT 
        to_char(gs.month, 'YYYY-MM') as month,
        COALESCE(
          (COUNT(CASE WHEN f.status = 'Atrasada' THEN 1 END)::numeric / NULLIF(COUNT(f.id), 0)::numeric) * 100, 
        0) as rate
      FROM generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), '1 month') AS gs(month)
      LEFT JOIN faturas f ON date_trunc('month', f.data_vencimento) = gs.month AND f.lojista_id = auth.uid()
      GROUP BY gs.month
      ORDER BY gs.month
    ) sub;

    RETURN json_build_object(
        'kpis', kpis_data,
        'salesChart', sales_chart_data,
        'clientsChart', clients_chart_data,
        'defaultsChart', defaults_chart_data
    );
END;
$$;

-- 6. get_portal_dashboard_data
DROP FUNCTION IF EXISTS public.get_portal_dashboard_data(uuid);
CREATE OR REPLACE FUNCTION public.get_portal_dashboard_data(p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'nome_cliente', c.nome,
        'limite_disponivel', ca.limite - ca.saldo_utilizado,
        'fatura_atual', COALESCE((SELECT valor_total FROM faturas WHERE cliente_id = p_cliente_id AND status = 'Aberta' ORDER BY data_vencimento DESC LIMIT 1), 0),
        'proximo_vencimento', (SELECT data_vencimento FROM faturas WHERE cliente_id = p_cliente_id AND status = 'Aberta' ORDER BY data_vencimento ASC LIMIT 1),
        'limite_total', ca.limite
    )
    INTO result
    FROM clientes c
    JOIN cartoes ca ON c.id = ca.cliente_id
    WHERE c.id = p_cliente_id;

    RETURN result;
END;
$$;
