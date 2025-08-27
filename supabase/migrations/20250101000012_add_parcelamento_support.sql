/*
# [ADD PARCELAMENTO SUPPORT]

Esta migração adiciona suporte completo para vendas parceladas:
1. Adiciona campos para identificar transações parceladas
2. Adiciona campo para vincular parcelas à transação original
3. Cria função para gerar faturas parceladas
4. Cria função para calcular datas de vencimento baseadas no melhor dia de compra
*/

-- Adicionar campos para suporte a parcelamento na tabela transacoes
ALTER TABLE public.transacoes 
ADD COLUMN IF NOT EXISTS transacao_original_id uuid REFERENCES public.transacoes(id),
ADD COLUMN IF NOT EXISTS data_vencimento_parcela DATE;

-- Comentários explicativos
COMMENT ON COLUMN public.transacoes.transacao_original_id IS 'ID da transação original (para parcelas de uma venda parcelada)';
COMMENT ON COLUMN public.transacoes.data_vencimento_parcela IS 'Data de vencimento específica desta parcela';

-- Função para calcular próxima data de vencimento baseada no melhor dia de compra
CREATE OR REPLACE FUNCTION calcular_data_vencimento(
    p_lojista_id uuid,
    p_meses_adicionar integer DEFAULT 1
)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_melhor_dia integer;
    v_data_base date;
    v_data_vencimento date;
BEGIN
    -- Buscar o melhor dia de compra configurado pelo lojista
    SELECT melhor_dia_compra INTO v_melhor_dia
    FROM configuracoes
    WHERE lojista_id = p_lojista_id;
    
    -- Se não encontrou configuração, usar dia 5 como padrão
    IF v_melhor_dia IS NULL THEN
        v_melhor_dia := 5;
    END IF;
    
    -- Calcular data base (próximo mês + meses adicionais)
    v_data_base := date_trunc('month', CURRENT_DATE) + interval '1 month' * p_meses_adicionar;
    
    -- Tentar criar a data com o melhor dia
    BEGIN
        v_data_vencimento := v_data_base + interval '1 day' * (v_melhor_dia - 1);
    EXCEPTION
        WHEN OTHERS THEN
            -- Se o dia não existe no mês (ex: 31 em fevereiro), usar último dia do mês
            v_data_vencimento := (date_trunc('month', v_data_base) + interval '1 month' - interval '1 day')::date;
    END;
    
    RETURN v_data_vencimento;
END;
$$;

-- Função para criar faturas parceladas
CREATE OR REPLACE FUNCTION criar_faturas_parceladas(
    p_lojista_id uuid,
    p_cliente_id uuid,
    p_cartao_id uuid,
    p_descricao text,
    p_valor_total numeric,
    p_categoria text,
    p_total_parcelas integer
)
RETURNS uuid -- Retorna ID da transação original
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transacao_original_id uuid;
    v_valor_parcela numeric;
    v_fatura_id uuid;
    v_competencia text;
    v_data_vencimento date;
    i integer;
BEGIN
    -- Calcular valor de cada parcela
    v_valor_parcela := p_valor_total / p_total_parcelas;
    
    -- Criar transação original (primeira parcela)
    v_data_vencimento := calcular_data_vencimento(p_lojista_id, 1);
    v_competencia := to_char(v_data_vencimento, 'YYYY-MM');
    
    -- Buscar ou criar fatura para a primeira parcela
    SELECT id INTO v_fatura_id
    FROM faturas
    WHERE lojista_id = p_lojista_id 
      AND cliente_id = p_cliente_id 
      AND competencia = v_competencia;
    
    IF v_fatura_id IS NULL THEN
        INSERT INTO faturas (
            lojista_id, cliente_id, competencia, 
            data_vencimento, data_fechamento, 
            valor_total, pagamento_minimo
        ) VALUES (
            p_lojista_id, p_cliente_id, v_competencia,
            v_data_vencimento, v_data_vencimento - interval '5 days',
            v_valor_parcela, v_valor_parcela * 0.15
        ) RETURNING id INTO v_fatura_id;
    ELSE
        -- Atualizar fatura existente
        UPDATE faturas 
        SET valor_total = valor_total + v_valor_parcela,
            pagamento_minimo = (valor_total + v_valor_parcela) * 0.15
        WHERE id = v_fatura_id;
    END IF;
    
    -- Inserir transação original
    INSERT INTO transacoes (
        lojista_id, cartao_id, cliente_id, fatura_id,
        descricao, valor, categoria,
        parcela_atual, total_parcelas,
        data_vencimento_parcela
    ) VALUES (
        p_lojista_id, p_cartao_id, p_cliente_id, v_fatura_id,
        p_descricao, v_valor_parcela, p_categoria,
        1, p_total_parcelas,
        v_data_vencimento
    ) RETURNING id INTO v_transacao_original_id;
    
    -- Criar parcelas restantes
    FOR i IN 2..p_total_parcelas LOOP
        v_data_vencimento := calcular_data_vencimento(p_lojista_id, i);
        v_competencia := to_char(v_data_vencimento, 'YYYY-MM');
        
        -- Buscar ou criar fatura para esta parcela
        SELECT id INTO v_fatura_id
        FROM faturas
        WHERE lojista_id = p_lojista_id 
          AND cliente_id = p_cliente_id 
          AND competencia = v_competencia;
        
        IF v_fatura_id IS NULL THEN
            INSERT INTO faturas (
                lojista_id, cliente_id, competencia, 
                data_vencimento, data_fechamento, 
                valor_total, pagamento_minimo
            ) VALUES (
                p_lojista_id, p_cliente_id, v_competencia,
                v_data_vencimento, v_data_vencimento - interval '5 days',
                v_valor_parcela, v_valor_parcela * 0.15
            ) RETURNING id INTO v_fatura_id;
        ELSE
            -- Atualizar fatura existente
            UPDATE faturas 
            SET valor_total = valor_total + v_valor_parcela,
                pagamento_minimo = (valor_total + v_valor_parcela) * 0.15
            WHERE id = v_fatura_id;
        END IF;
        
        -- Inserir parcela
        INSERT INTO transacoes (
            lojista_id, cartao_id, cliente_id, fatura_id,
            descricao, valor, categoria,
            parcela_atual, total_parcelas,
            transacao_original_id, data_vencimento_parcela
        ) VALUES (
            p_lojista_id, p_cartao_id, p_cliente_id, v_fatura_id,
            p_descricao || ' (' || i || '/' || p_total_parcelas || ')',
            v_valor_parcela, p_categoria,
            i, p_total_parcelas,
            v_transacao_original_id, v_data_vencimento
        );
    END LOOP;
    
    RETURN v_transacao_original_id;
END;
$$;

-- Comentários nas funções
COMMENT ON FUNCTION calcular_data_vencimento(uuid, integer) IS 'Calcula data de vencimento baseada no melhor dia de compra configurado pelo lojista';
COMMENT ON FUNCTION criar_faturas_parceladas(uuid, uuid, uuid, text, numeric, text, integer) IS 'Cria transações e faturas para vendas parceladas';