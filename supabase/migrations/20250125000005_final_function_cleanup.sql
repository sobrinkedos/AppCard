-- Limpeza final e definitiva das funções para resolver sobrecarga
-- Remove TODAS as versões existentes das funções, independente da assinatura

-- Remover todas as versões possíveis da função registrar_recebimento_parcial
DROP FUNCTION IF EXISTS public.registrar_recebimento_parcial(uuid, numeric, text, date, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_recebimento_parcial(uuid, numeric, text, date, text) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_recebimento_parcial CASCADE;

-- Remover todas as versões possíveis da função registrar_recebimento
DROP FUNCTION IF EXISTS public.registrar_recebimento(uuid, numeric, text, date, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_recebimento(uuid, numeric, text, date) CASCADE;
DROP FUNCTION IF EXISTS public.registrar_recebimento CASCADE;

-- Criar APENAS a versão final da função registrar_recebimento_parcial (SEM p_lojista_id)
CREATE FUNCTION public.registrar_recebimento_parcial(
    p_fatura_id uuid,
    p_valor_pago numeric,
    p_forma_pagamento text,
    p_data_pagamento date,
    p_acao_remanescente text DEFAULT 'manter'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lojista_id uuid;
    v_fatura faturas%ROWTYPE;
    v_valor_remanescente numeric;
    v_nova_fatura_id uuid;
    v_competencia_nova text;
    v_data_vencimento_nova date;
BEGIN
    -- Obter lojista_id do usuário autenticado ou da fatura
    v_lojista_id := auth.uid();
    
    IF v_lojista_id IS NULL THEN
        SELECT lojista_id INTO v_lojista_id
        FROM faturas
        WHERE id = p_fatura_id;
    END IF;
    
    IF v_lojista_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Lojista não encontrado'
        );
    END IF;
    
    -- Buscar dados da fatura
    SELECT * INTO v_fatura
    FROM faturas
    WHERE id = p_fatura_id AND lojista_id = v_lojista_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Fatura não encontrada'
        );
    END IF;
    
    -- Calcular valor remanescente
    v_valor_remanescente := v_fatura.valor_total - COALESCE(v_fatura.valor_pago, 0) - p_valor_pago;
    
    -- Registrar o recebimento
    INSERT INTO recebimentos (
        lojista_id,
        fatura_id,
        valor,
        forma_pagamento,
        data_recebimento
    ) VALUES (
        v_lojista_id,
        p_fatura_id,
        p_valor_pago,
        p_forma_pagamento,
        p_data_pagamento
    );
    
    -- Atualizar valor pago da fatura
    UPDATE faturas
    SET valor_pago = COALESCE(valor_pago, 0) + p_valor_pago
    WHERE id = p_fatura_id;
    
    -- Atualizar saldo do cartão
    PERFORM atualizar_saldo_cartao(v_fatura.cliente_id, p_valor_pago);
    
    -- Determinar ação baseada no valor remanescente
    IF v_valor_remanescente <= 0 THEN
        -- Pagamento completo
        UPDATE faturas
        SET status = 'Paga'
        WHERE id = p_fatura_id;
        
        RETURN json_build_object(
            'success', true,
            'status_final', 'Paga',
            'valor_total_pago', v_fatura.valor_total,
            'valor_remanescente', 0
        );
    ELSE
        -- Pagamento parcial
        IF p_acao_remanescente = 'proxima_fatura' THEN
            -- Criar nova fatura para o valor remanescente
            v_competencia_nova := to_char(v_fatura.data_vencimento + interval '1 month', 'YYYY-MM');
            v_data_vencimento_nova := v_fatura.data_vencimento + interval '1 month';
            
            INSERT INTO faturas (
                lojista_id,
                cliente_id,
                competencia,
                data_vencimento,
                data_fechamento,
                valor_total,
                pagamento_minimo,
                status
            ) VALUES (
                v_lojista_id,
                v_fatura.cliente_id,
                v_competencia_nova,
                v_data_vencimento_nova,
                v_data_vencimento_nova - interval '5 days',
                v_valor_remanescente,
                v_valor_remanescente * 0.15,
                'Aberta'
            ) RETURNING id INTO v_nova_fatura_id;
            
            -- Marcar fatura atual como paga
            UPDATE faturas
            SET status = 'Paga'
            WHERE id = p_fatura_id;
            
            RETURN json_build_object(
                'success', true,
                'status_final', 'Paga',
                'nova_fatura_id', v_nova_fatura_id,
                'valor_nova_fatura', v_valor_remanescente,
                'valor_remanescente', 0
            );
        ELSE
            -- Manter valor remanescente na fatura atual
            UPDATE faturas
            SET status = 'Parcialmente Paga'
            WHERE id = p_fatura_id;
            
            RETURN json_build_object(
                'success', true,
                'status_final', 'Parcialmente Paga',
                'valor_pago_total', COALESCE(v_fatura.valor_pago, 0) + p_valor_pago,
                'valor_remanescente', v_valor_remanescente
            );
        END IF;
    END IF;
END;
$$;

-- Criar APENAS a versão final da função registrar_recebimento (SEM p_lojista_id)
CREATE FUNCTION public.registrar_recebimento(
    p_fatura_id uuid,
    p_valor_pago numeric,
    p_forma_pagamento text,
    p_data_pagamento date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lojista_id uuid;
    v_fatura faturas%ROWTYPE;
BEGIN
    -- Obter lojista_id do usuário autenticado ou da fatura
    v_lojista_id := auth.uid();
    
    IF v_lojista_id IS NULL THEN
        SELECT lojista_id INTO v_lojista_id
        FROM faturas
        WHERE id = p_fatura_id;
    END IF;
    
    IF v_lojista_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Lojista não encontrado'
        );
    END IF;
    
    -- Buscar dados da fatura
    SELECT * INTO v_fatura
    FROM faturas
    WHERE id = p_fatura_id AND lojista_id = v_lojista_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Fatura não encontrada'
        );
    END IF;
    
    -- Registrar o recebimento
    INSERT INTO recebimentos (
        lojista_id,
        fatura_id,
        valor,
        forma_pagamento,
        data_recebimento
    ) VALUES (
        v_lojista_id,
        p_fatura_id,
        p_valor_pago,
        p_forma_pagamento,
        p_data_pagamento
    );
    
    -- Atualizar fatura como paga
    UPDATE faturas
    SET 
        valor_pago = p_valor_pago,
        status = 'Paga'
    WHERE id = p_fatura_id;
    
    -- Atualizar saldo do cartão
    PERFORM atualizar_saldo_cartao(v_fatura.cliente_id, p_valor_pago);
    
    RETURN json_build_object(
        'success', true,
        'status_final', 'Paga',
        'valor_total_pago', p_valor_pago
    );
END;
$$;

-- Comentários nas funções
COMMENT ON FUNCTION registrar_recebimento_parcial(uuid, numeric, text, date, text) IS 'Registra recebimento parcial de fatura - VERSÃO ÚNICA E FINAL';
COMMENT ON FUNCTION registrar_recebimento(uuid, numeric, text, date) IS 'Registra recebimento completo de fatura - VERSÃO ÚNICA E FINAL';