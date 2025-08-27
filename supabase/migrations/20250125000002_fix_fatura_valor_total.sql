-- Função para recalcular o valor total das faturas baseado nas transações
CREATE OR REPLACE FUNCTION public.recalcular_valor_total_fatura(
    p_fatura_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_valor_total_calculado numeric;
BEGIN
    -- Calcular o valor total baseado na soma das transações
    SELECT COALESCE(SUM(valor), 0)
    INTO v_valor_total_calculado
    FROM transacoes
    WHERE fatura_id = p_fatura_id;
    
    -- Atualizar o valor total da fatura
    UPDATE faturas
    SET 
        valor_total = v_valor_total_calculado,
        pagamento_minimo = v_valor_total_calculado * 0.15
    WHERE id = p_fatura_id;
END;
$$;

-- Função para recalcular todas as faturas de um lojista
CREATE OR REPLACE FUNCTION public.recalcular_todas_faturas(
    p_lojista_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lojista_id uuid;
    v_fatura_record RECORD;
BEGIN
    -- Determinar lojista_id
    IF p_lojista_id IS NOT NULL THEN
        v_lojista_id := p_lojista_id;
    ELSE
        v_lojista_id := auth.uid();
    END IF;
    
    -- Verificar se encontrou lojista_id
    IF v_lojista_id IS NULL THEN
        RAISE EXCEPTION 'Lojista não encontrado';
    END IF;
    
    -- Recalcular todas as faturas do lojista
    FOR v_fatura_record IN 
        SELECT id FROM faturas WHERE lojista_id = v_lojista_id
    LOOP
        PERFORM recalcular_valor_total_fatura(v_fatura_record.id);
    END LOOP;
END;
$$;

-- Trigger para atualizar automaticamente o valor total da fatura quando transações são inseridas/atualizadas/deletadas
CREATE OR REPLACE FUNCTION public.trigger_atualizar_valor_fatura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Para INSERT e UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM recalcular_valor_total_fatura(NEW.fatura_id);
        RETURN NEW;
    END IF;
    
    -- Para DELETE
    IF TG_OP = 'DELETE' THEN
        PERFORM recalcular_valor_total_fatura(OLD.fatura_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Criar o trigger
DROP TRIGGER IF EXISTS trigger_atualizar_valor_fatura_on_transacoes ON transacoes;
CREATE TRIGGER trigger_atualizar_valor_fatura_on_transacoes
    AFTER INSERT OR UPDATE OR DELETE ON transacoes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_atualizar_valor_fatura();

-- Recalcular todas as faturas existentes para corrigir inconsistências
DO $$
DECLARE
    v_fatura_record RECORD;
BEGIN
    FOR v_fatura_record IN 
        SELECT DISTINCT f.id
        FROM faturas f
        WHERE EXISTS (SELECT 1 FROM transacoes t WHERE t.fatura_id = f.id)
    LOOP
        PERFORM recalcular_valor_total_fatura(v_fatura_record.id);
    END LOOP;
END;
$$;