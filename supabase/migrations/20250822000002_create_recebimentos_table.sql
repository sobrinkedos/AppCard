/*
# [CREATE RECEBIMENTOS TABLE]

Esta migração cria a tabela de recebimentos que estava faltando no schema.
A tabela é necessária para armazenar os registros de pagamentos das faturas.
*/

-- Criar tabela de recebimentos
CREATE TABLE IF NOT EXISTS public.recebimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid REFERENCES auth.users(id) NOT NULL,
    fatura_id uuid REFERENCES public.faturas(id) ON DELETE CASCADE NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    forma_pagamento TEXT NOT NULL,
    data_recebimento DATE NOT NULL,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

-- Criar política RLS
CREATE POLICY "Enable all access for authenticated users"
ON public.recebimentos
FOR ALL
TO authenticated
USING (lojista_id = auth.uid());

-- Adicionar campo valor_pago na tabela faturas se não existir
ALTER TABLE public.faturas 
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10, 2) DEFAULT 0;

-- Criar função para obter recebimentos
CREATE OR REPLACE FUNCTION public.get_recebimentos(
    p_data_inicio date DEFAULT NULL,
    p_data_fim date DEFAULT NULL,
    p_forma_pagamento text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    fatura_id uuid,
    valor numeric,
    forma_pagamento text,
    data_recebimento date,
    data_criacao timestamptz,
    competencia varchar,
    valor_pago numeric,
    clientes json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.fatura_id,
        r.valor,
        r.forma_pagamento,
        r.data_recebimento,
        r.data_criacao,
        f.competencia,
        r.valor as valor_pago,
        json_build_object('nome', c.nome, 'email', c.email) as clientes
    FROM public.recebimentos r
    JOIN public.faturas f ON r.fatura_id = f.id
    JOIN public.clientes c ON f.cliente_id = c.id
    WHERE r.lojista_id = auth.uid()
    AND (p_data_inicio IS NULL OR r.data_recebimento >= p_data_inicio)
    AND (p_data_fim IS NULL OR r.data_recebimento <= p_data_fim)
    AND (p_forma_pagamento IS NULL OR r.forma_pagamento = p_forma_pagamento)
    ORDER BY r.data_recebimento DESC;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION get_recebimentos(date, date, text) IS 'Obtém lista de recebimentos com filtros opcionais';