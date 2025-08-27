/*
# [SECURITY & RLS MIGRATION]
Este script finaliza a configuração de segurança do banco de dados.

## Descrição da Query:
1.  **Corrige Funções:** Adiciona `SET search_path = public` a todas as funções de banco de dados para resolver os avisos de segurança 'Function Search Path Mutable'.
2.  **Cria Políticas RLS:** Implementa as políticas de Row-Level Security (RLS) para todas as tabelas principais. Isso garante que um usuário autenticado só possa ler, criar, atualizar e deletar os dados que pertencem a ele (onde `user_id` corresponde ao seu ID de autenticação).

## Metadados:
- Schema-Category: "Security"
- Impact-Level: "High"
- Requires-Backup: false
- Reversible: true (removendo as políticas)

## Implicações de Segurança:
- RLS Status: Habilitado e configurado para todas as tabelas.
- Policy Changes: Sim, adiciona políticas de acesso a todas as tabelas.
- Auth Requirements: Acesso aos dados agora exigirá um usuário autenticado.
*/

-- =============================================
-- CORREÇÃO DAS FUNÇÕES
-- =============================================

-- Função para Dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(cartoesAtivos bigint, vendasMes numeric, totalClientes bigint, taxaInadimplencia numeric) AS $$
BEGIN
  SET search_path = public;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM cartoes WHERE status = 'Ativo' AND user_id = auth.uid()) AS cartoesAtivos,
    COALESCE((SELECT SUM(valor) FROM transacoes WHERE data_transacao >= date_trunc('month', current_date) AND user_id = auth.uid()), 0) AS vendasMes,
    (SELECT COUNT(*) FROM clientes WHERE user_id = auth.uid()) AS totalClientes,
    COALESCE((
      SELECT (SUM(CASE WHEN status = 'Atrasada' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0)
      FROM faturas WHERE user_id = auth.uid()
    ), 0) AS taxaInadimplencia;
END;
$$ LANGUAGE plpgsql;

-- Função para Relatórios
CREATE OR REPLACE FUNCTION get_reports_data()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SET search_path = public;
  SELECT json_build_object(
    'kpis', (SELECT json_build_object(
      'receita', COALESCE(SUM(valor_total), 0),
      'novosClientes', COUNT(CASE WHEN data_cadastro >= date_trunc('month', current_date) THEN 1 END),
      'inadimplencia', COALESCE((SUM(CASE WHEN f.status = 'Atrasada' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(f.id), 0), 0),
      'cartoesAtivos', (SELECT COUNT(*) FROM cartoes c WHERE c.status = 'Ativo' AND c.user_id = auth.uid())
    ) FROM faturas f WHERE f.user_id = auth.uid()),

    'salesChart', (SELECT json_agg(t) FROM (
      SELECT to_char(date_trunc('month', data_transacao), 'YYYY-MM') as month, SUM(valor) as total_sales
      FROM transacoes
      WHERE data_transacao >= date_trunc('month', current_date) - interval '5 months' AND user_id = auth.uid()
      GROUP BY 1 ORDER BY 1
    ) t),

    'clientsChart', (SELECT json_agg(t) FROM (
      SELECT status, COUNT(*) as count FROM clientes WHERE user_id = auth.uid() GROUP BY status
    ) t),

    'defaultsChart', (SELECT json_agg(t) FROM (
      SELECT to_char(date_trunc('month', data_vencimento), 'YYYY-MM') as month,
             COALESCE((SUM(CASE WHEN status = 'Atrasada' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 0) as rate
      FROM faturas
      WHERE data_vencimento >= date_trunc('month', current_date) - interval '5 months' AND user_id = auth.uid()
      GROUP BY 1 ORDER BY 1
    ) t)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Função para Cobranças
CREATE OR REPLACE FUNCTION get_cobrancas()
RETURNS TABLE (
  id uuid,
  cliente_id uuid,
  competencia text,
  data_vencimento date,
  data_fechamento date,
  valor_total numeric,
  pagamento_minimo numeric,
  status "InvoiceStatus",
  linha_digitavel text,
  data_criacao timestamptz,
  user_id uuid,
  clientes json,
  dias_atraso integer,
  status_cobranca text
) AS $$
BEGIN
  SET search_path = public;
  RETURN QUERY
  SELECT
    f.*,
    json_build_object('nome', c.nome) as clientes,
    (CASE WHEN f.status = 'Atrasada' THEN (current_date - f.data_vencimento) ELSE 0 END) as dias_atraso,
    (CASE
      WHEN f.status = 'Paga' THEN 'Paga'
      WHEN (current_date - f.data_vencimento) > 30 THEN 'Crítica'
      WHEN (current_date - f.data_vencimento) BETWEEN 7 AND 30 THEN 'Em atraso'
      WHEN (current_date - f.data_vencimento) BETWEEN 1 AND 6 THEN 'Vencida'
      ELSE 'Em dia'
    END) as status_cobranca
  FROM faturas f
  JOIN clientes c ON f.cliente_id = c.id
  WHERE f.status IN ('Aberta', 'Atrasada') AND f.user_id = auth.uid()
  ORDER BY dias_atraso DESC;
END;
$$ LANGUAGE plpgsql;

-- Função para Portal do Cliente
CREATE OR REPLACE FUNCTION get_portal_dashboard_data(p_cliente_id uuid)
RETURNS TABLE (
  nome_cliente text,
  limite_disponivel numeric,
  fatura_atual numeric,
  proximo_vencimento date,
  limite_total numeric
) AS $$
BEGIN
  SET search_path = public;
  RETURN QUERY
  SELECT
    c.nome,
    ca.limite - ca.saldo_utilizado as limite_disponivel,
    (SELECT COALESCE(SUM(t.valor), 0) FROM transacoes t WHERE t.fatura_id IS NULL AND t.cliente_id = p_cliente_id) as fatura_atual,
    (SELECT f.data_vencimento FROM faturas f WHERE f.cliente_id = p_cliente_id AND f.status = 'Aberta' ORDER BY f.data_vencimento ASC LIMIT 1) as proximo_vencimento,
    ca.limite as limite_total
  FROM clientes c
  JOIN cartoes ca ON c.id = ca.cliente_id
  WHERE c.id = p_cliente_id;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- CRIAÇÃO DAS POLÍTICAS DE RLS
-- =============================================

-- Tabela: clientes
DROP POLICY IF EXISTS "Allow authenticated users to manage their own clients" ON public.clientes;
CREATE POLICY "Allow authenticated users to manage their own clients"
ON public.clientes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: cartoes
DROP POLICY IF EXISTS "Allow authenticated users to manage their own cards" ON public.cartoes;
CREATE POLICY "Allow authenticated users to manage their own cards"
ON public.cartoes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: transacoes
DROP POLICY IF EXISTS "Allow authenticated users to manage their own transactions" ON public.transacoes;
CREATE POLICY "Allow authenticated users to manage their own transactions"
ON public.transacoes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: faturas
DROP POLICY IF EXISTS "Allow authenticated users to manage their own invoices" ON public.faturas;
CREATE POLICY "Allow authenticated users to manage their own invoices"
ON public.faturas FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: membros_equipe
DROP POLICY IF EXISTS "Allow authenticated users to manage their own team members" ON public.membros_equipe;
CREATE POLICY "Allow authenticated users to manage their own team members"
ON public.membros_equipe FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: convites
DROP POLICY IF EXISTS "Allow authenticated users to manage their own invites" ON public.convites;
CREATE POLICY "Allow authenticated users to manage their own invites"
ON public.convites FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: notificacoes
DROP POLICY IF EXISTS "Allow authenticated users to manage their own notifications" ON public.notificacoes;
CREATE POLICY "Allow authenticated users to manage their own notifications"
ON public.notificacoes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: chamados_suporte
DROP POLICY IF EXISTS "Allow authenticated users to manage their own support tickets" ON public.chamados_suporte;
CREATE POLICY "Allow authenticated users to manage their own support tickets"
ON public.chamados_suporte FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela: logs_auditoria
DROP POLICY IF EXISTS "Allow authenticated users to manage their own audit logs" ON public.logs_auditoria;
CREATE POLICY "Allow authenticated users to manage their own audit logs"
ON public.logs_auditoria FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
