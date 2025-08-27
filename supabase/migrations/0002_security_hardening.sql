/*
          # [SECURITY HARDENING] - Habilitar RLS e Corrigir Funções
          Este script corrige as vulnerabilidades de segurança críticas apontadas pelo Supabase Advisor.
          Ele habilita o Row-Level Security (RLS) em todas as tabelas e define um search_path seguro para todas as funções.

          ## Query Description: 
          - Habilita o RLS em todas as 9 tabelas do schema public.
          - Cria políticas de segurança padrão que restringem o acesso a usuários autenticados. Isso é um passo fundamental para proteger seus dados.
          - Altera 6 funções para definir um `search_path` fixo, prevenindo ataques de "search path hijacking".
          - **Atenção:** Após aplicar este script, o acesso anônimo aos dados será bloqueado. A aplicação precisará de um sistema de login para funcionar.

          ## Metadata:
          - Schema-Category: "Security"
          - Impact-Level: "High"
          - Requires-Backup: false
          - Reversible: true (desabilitando o RLS e removendo as políticas)

          ## Security Implications:
          - RLS Status: Habilitado para todas as tabelas.
          - Policy Changes: Sim, adiciona políticas de acesso para usuários autenticados.
          - Auth Requirements: Acesso ao banco de dados exigirá autenticação.
*/

-- Habilitar RLS para todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas (se existirem) e criar novas políticas de segurança
-- Esta política padrão permite acesso total para qualquer usuário autenticado.
-- Em um ambiente de produção, você pode querer políticas mais granulares baseadas em roles.

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.clientes;
CREATE POLICY "Allow full access to authenticated users" ON public.clientes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.cartoes;
CREATE POLICY "Allow full access to authenticated users" ON public.cartoes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.transacoes;
CREATE POLICY "Allow full access to authenticated users" ON public.transacoes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.faturas;
CREATE POLICY "Allow full access to authenticated users" ON public.faturas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.membros_equipe;
CREATE POLICY "Allow full access to authenticated users" ON public.membros_equipe FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.convites;
CREATE POLICY "Allow full access to authenticated users" ON public.convites FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.notificacoes;
CREATE POLICY "Allow full access to authenticated users" ON public.notificacoes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.logs_auditoria;
CREATE POLICY "Allow full access to authenticated users" ON public.logs_auditoria FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.chamados_suporte;
CREATE POLICY "Allow full access to authenticated users" ON public.chamados_suporte FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- Corrigir o search_path das funções para prevenir "search path hijacking"
ALTER FUNCTION public.get_dashboard_stats() SET search_path = public;
ALTER FUNCTION public.get_sales_last_6_months() SET search_path = public;
ALTER FUNCTION public.get_card_status_counts() SET search_path = public;
ALTER FUNCTION public.get_cobrancas() SET search_path = public;
ALTER FUNCTION public.get_reports_data() SET search_path = public;
ALTER FUNCTION public.get_portal_dashboard_data(p_cliente_id uuid) SET search_path = public;
