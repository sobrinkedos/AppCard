/*
          # [Operation Name]
          Correção de Funções do Banco de Dados e Segurança

          ## Query Description: [Esta operação irá substituir as funções existentes 'get_dashboard_stats' e 'get_reports_data' por versões corrigidas. As novas versões previnem erros de "divisão por zero" que ocorrem quando não há dados suficientes para os cálculos (ex: nenhuma fatura no sistema). Além disso, o 'search_path' será definido explicitamente para resolver avisos de segurança.]
          
          ## Metadata:
          - Schema-Category: ["Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Funções Afetadas: get_dashboard_stats(), get_reports_data()
          
          ## Security Implications:
          - RLS Status: [N/A]
          - Policy Changes: [No]
          - Auth Requirements: [Nenhum]
          
          ## Performance Impact:
          - Indexes: [N/A]
          - Triggers: [N/A]
          - Estimated Impact: [Nenhum impacto de performance esperado. As mudanças são para garantir a robustez das funções.]
          */

-- Remove as funções antigas se existirem
DROP FUNCTION IF EXISTS get_dashboard_stats();
DROP FUNCTION IF EXISTS get_reports_data();


-- Recria a função get_dashboard_stats com a correção
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(cartoesAtivos bigint, vendasMes numeric, totalClientes bigint, taxaInadimplencia numeric) AS $$
BEGIN
  SET search_path = public;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM cartoes WHERE status = 'Ativo' AND loja_id = auth.uid()) AS cartoesAtivos,
    COALESCE((SELECT SUM(valor) FROM transacoes WHERE data_transacao >= date_trunc('month', current_date) AND loja_id = auth.uid()), 0) AS vendasMes,
    (SELECT COUNT(*) FROM clientes WHERE loja_id = auth.uid()) AS totalClientes,
    COALESCE(
      (
        (SELECT COUNT(*) FROM faturas WHERE status = 'Atrasada' AND loja_id = auth.uid())::numeric /
        NULLIF((SELECT COUNT(*) FROM faturas WHERE loja_id = auth.uid()), 0)
      ) * 100, 0
    ) AS taxaInadimplencia;
END;
$$ LANGUAGE plpgsql;

-- Recria a função get_reports_data com a correção
CREATE OR REPLACE FUNCTION get_reports_data()
RETURNS json AS $$
DECLARE
  kpis_data json;
  sales_chart_data json;
  clients_chart_data json;
  defaults_chart_data json;
BEGIN
  SET search_path = public;

  -- KPIs
  SELECT json_build_object(
    'receita', COALESCE(SUM(valor_total), 0),
    'novosClientes', COUNT(DISTINCT CASE WHEN data_cadastro >= date_trunc('month', current_date) THEN id END),
    'inadimplencia', COALESCE(
      (
        (SELECT COUNT(*) FROM faturas WHERE status = 'Atrasada' AND loja_id = auth.uid())::numeric /
        NULLIF((SELECT COUNT(*) FROM faturas WHERE loja_id = auth.uid()), 0)
      ) * 100, 0
    ),
    'cartoesAtivos', (SELECT COUNT(*) FROM cartoes WHERE status = 'Ativo' AND loja_id = auth.uid())
  ) INTO kpis_data
  FROM faturas
  WHERE loja_id = auth.uid();

  -- Sales Chart
  SELECT json_agg(t) INTO sales_chart_data FROM (
    SELECT 
      to_char(date_trunc('month', data_transacao), 'YYYY-MM') as month,
      SUM(valor) as total_sales
    FROM transacoes
    WHERE loja_id = auth.uid()
    GROUP BY 1 ORDER BY 1
  ) t;

  -- Clients Chart
  SELECT json_agg(t) INTO clients_chart_data FROM (
    SELECT status, COUNT(*) as count
    FROM clientes
    WHERE loja_id = auth.uid()
    GROUP BY 1
  ) t;

  -- Defaults Chart
  SELECT json_agg(t) INTO defaults_chart_data FROM (
    SELECT
      to_char(date_trunc('month', data_vencimento), 'YYYY-MM') as month,
      COALESCE(
        (
          SUM(CASE WHEN status = 'Atrasada' THEN 1 ELSE 0 END)::numeric /
          NULLIF(COUNT(*), 0)
        ) * 100, 0
      ) as rate
    FROM faturas
    WHERE loja_id = auth.uid()
    GROUP BY 1 ORDER BY 1
  ) t;

  RETURN json_build_object(
    'kpis', COALESCE(kpis_data, '{}'::json),
    'salesChart', COALESCE(sales_chart_data, '[]'::json),
    'clientsChart', COALESCE(clients_chart_data, '[]'::json),
    'defaultsChart', COALESCE(defaults_chart_data, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;
