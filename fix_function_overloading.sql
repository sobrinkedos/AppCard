-- Remover funções duplicadas para resolver conflito de sobrecarga

-- Primeiro, remover todas as versões antigas das funções
DROP FUNCTION IF EXISTS public.registrar_recebimento_parcial(uuid, numeric, text, date, text, uuid);
DROP FUNCTION IF EXISTS public.registrar_recebimento(uuid, numeric, text, date, uuid);

-- Recriar apenas a versão mais recente e correta da função registrar_recebimento_parcial
CREATE OR REPLACE FUNCTION public.registrar_recebimento_parcial(
    p_fatura_id uuid,
    p_valor_pago numeric,
    p_forma_pagamento text,
    p_data_pagamento date,
    p_acao_remanescente text DEFAULT 'manter',
    p_lojista_id uuid DEFAULT NULL
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
    -- Determinar lojista_id
    IF p_lojista_id IS NOT NULL THEN
        v_lojista_id := p_lojista_id;
    ELSE
        -- Tentar obter do usuário autenticado
        v_lojista_id := auth.uid();
        
        -- Se não há usuário autenticado, buscar da fatura
        IF v_lojista_id IS NULL THEN
            SELECT lojista_id INTO v_lojista_id
            FROM faturas
            WHERE id = p_fatura_id;
        END IF;
    END IF;
    
    -- Verificar se encontrou lojista_id
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
    
    -- Registrar o recebimento na tabela de recebimentos
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
    
    -- Chamar função para atualizar saldo do cartão
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
            -- Calcular nova competência (próximo mês)
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
            SET status = 'Paga',
                valor_total = COALESCE(valor_pago, 0)
            WHERE id = p_fatura_id;
            
            RETURN json_build_object(
                'success', true,
                'status_final', 'Paga',
                'valor_total_pago', COALESCE(v_fatura.valor_pago, 0) + p_valor_pago,
                'valor_remanescente', v_valor_remanescente,
                'nova_fatura_id', v_nova_fatura_id
            );
        ELSE
            -- Manter na mesma fatura
            UPDATE faturas
            SET status = 'Parcialmente Paga'
            WHERE id = p_fatura_id;
            
            RETURN json_build_object(
                'success', true,
                'status_final', 'Parcialmente Paga',
                'valor_total_pago', COALESCE(v_fatura.valor_pago, 0) + p_valor_pago,
                'valor_remanescente', v_valor_remanescente
            );
        END IF;
    END IF;
END;
$$;

-- Recriar a função registrar_recebimento para pagamentos completos
CREATE OR REPLACE FUNCTION public.registrar_recebimento(
    p_fatura_id uuid,
    p_valor_pago numeric,
    p_forma_pagamento text,
    p_data_pagamento date,
    p_lojista_id uuid DEFAULT NULL
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
    -- Determinar lojista_id
    IF p_lojista_id IS NOT NULL THEN
        v_lojista_id := p_lojista_id;
    ELSE
        v_lojista_id := auth.uid();
        
        -- Se não há usuário autenticado, buscar da fatura
        IF v_lojista_id IS NULL THEN
            SELECT lojista_id INTO v_lojista_id
            FROM faturas
            WHERE id = p_fatura_id;
        END IF;
    END IF;
    
    -- Verificar se encontrou lojista_id
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
    
    -- Atualizar a fatura
    UPDATE faturas
    SET 
        valor_pago = p_valor_pago,
        status = 'Paga',
        data_pagamento = CURRENT_TIMESTAMP
    WHERE id = p_fatura_id;
    
    -- Atualizar o saldo_utilizado do cartão
    PERFORM atualizar_saldo_cartao(v_fatura.cliente_id, p_valor_pago);
    
    RETURN json_build_object(
        'success', true,
        'status_final', 'Paga',
        'valor_total_pago', p_valor_pago
    );
END;
$$;

-- Comentários nas funções
COMMENT ON FUNCTION registrar_recebimento_parcial(uuid, numeric, text, date, text, uuid) IS 'Registra recebimento parcial de fatura com opções para valor remanescente - VERSÃO FINAL';
COMMENT ON FUNCTION registrar_recebimento(uuid, numeric, text, date, uuid) IS 'Registra recebimento completo de fatura - VERSÃO FINAL';