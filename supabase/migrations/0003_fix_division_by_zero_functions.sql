/*
          # [Operation Name]
          Correção de Funções de Agregação

          ## Query Description: [Esta operação atualiza as funções do banco de dados para prevenir erros de "divisão por zero". As funções `get_dashboard_stats` e `get_reports_data` foram modificadas para usar `NULLIF` e `COALESCE`, garantindo que cálculos de taxas e médias retornem 0 em vez de causar um erro quando não há dados (ex: nenhuma fatura no sistema). Isso torna os cálculos mais robustos e resilientes.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Funções Afetadas: `get_dashboard_stats`, `get_reports_data`
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [No]
          - Auth Requirements: [N/A]
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [Nenhum impacto de performance esperado.]
          */

-- Corrige a função do Dashboard para evitar divisão por zero
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(cartoesAtivos bigint, vendasMes numeric, totalClientes bigint, taxaInadimplencia numeric) AS $$
DECLARE
    total_faturas_mes_atual bigint;
    faturas_atrasadas_mes_atual bigint;
BEGIN
    SELECT COUNT(*) INTO cartoesAtivos FROM public.cartoes WHERE status = 'Ativo';
    SELECT COALESCE(SUM(valor), 0) INTO vendasMes FROM public.transacoes WHERE data_transacao >= date_trunc('month', current_date);
    SELECT COUNT(*) INTO totalClientes FROM public.clientes;

    SELECT COUNT(*) INTO total_faturas_mes_atual FROM public.faturas WHERE date_trunc('month', data_vencimento) = date_trunc('month', current_date);
    SELECT COUNT(*) INTO faturas_atrasadas_mes_atual FROM public.faturas WHERE status = 'Atrasada' AND date_trunc('month', data_vencimento) = date_trunc('month', current_date);

    taxaInadimplencia := COALESCE((faturas_atrasadas_mes_atual::numeric * 100) / NULLIF(total_faturas_mes_atual, 0), 0);

    RETURN QUERY SELECT cartoesAtivos, vendasMes, totalClientes, taxaInadimplencia;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Corrige a função dos Relatórios para evitar divisão por zero
CREATE OR REPLACE FUNCTION get_reports_data()
RETURNS json AS $$
DECLARE
    _kpis json;
    _sales_chart json;
    _clients_chart json;
    _defaults_chart json;
    total_faturas bigint;
    faturas_atrasadas bigint;
    _inadimplencia numeric;
BEGIN
    SELECT COUNT(*) INTO total_faturas FROM public.faturas;
    SELECT COUNT(*) INTO faturas_atrasadas FROM public.faturas WHERE status = 'Atrasada';
    _inadimplencia := COALESCE((faturas_atrasadas::numeric * 100) / NULLIF(total_faturas, 0), 0);

    SELECT json_build_object(
        'receita', COALESCE((SELECT SUM(valor_total) FROM public.faturas WHERE status = 'Paga'), 0),
        'novosClientes', (SELECT COUNT(*) FROM public.clientes WHERE data_cadastro >= current_date - interval '30 days'),
        'inadimplencia', _inadimplencia,
        'cartoesAtivos', (SELECT COUNT(*) FROM public.cartoes WHERE status = 'Ativo')
    ) INTO _kpis;

    SELECT json_agg(t) INTO _sales_chart FROM (
        SELECT to_char(date_trunc('month', data_transacao), 'YYYY-MM') as month, SUM(valor) as total_sales
        FROM public.transacoes GROUP BY 1 ORDER BY 1
    ) t;

    SELECT json_agg(t) INTO _clients_chart FROM (
        SELECT status, COUNT(*) as count FROM public.clientes GROUP BY 1
    ) t;

    SELECT json_agg(t) INTO _defaults_chart FROM (
        SELECT
            to_char(date_trunc('month', f.data_vencimento), 'YYYY-MM') as month,
            COALESCE((COUNT(CASE WHEN f.status = 'Atrasada' THEN 1 END)::numeric * 100) / NULLIF(COUNT(*), 0), 0) as rate
        FROM public.faturas f GROUP BY 1 ORDER BY 1
    ) t;

    RETURN json_build_object(
        'kpis', _kpis,
        'salesChart', COALESCE(_sales_chart, '[]'::json),
        'clientsChart', COALESCE(_clients_chart, '[]'::json),
        'defaultsChart', COALESCE(_defaults_chart, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
