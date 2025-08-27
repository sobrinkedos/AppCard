-- =====================================================
-- Sistema de Histórico de Alterações de Clientes
-- =====================================================

-- Tabela para armazenar histórico de alterações dos clientes
CREATE TABLE historico_clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL,
    
    -- Dados do cliente na versão específica
    dados_anteriores JSONB,
    dados_novos JSONB,
    campos_alterados TEXT[],
    
    -- Metadados da alteração
    tipo_operacao VARCHAR(20) NOT NULL CHECK (tipo_operacao IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario_id uuid REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,
    motivo_alteracao TEXT,
    
    -- Timestamps
    data_alteracao TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Índices para performance
    UNIQUE(cliente_id, versao)
);

-- Índices para otimizar consultas
CREATE INDEX idx_historico_clientes_cliente_id ON historico_clientes(cliente_id);
CREATE INDEX idx_historico_clientes_data_alteracao ON historico_clientes(data_alteracao DESC);
CREATE INDEX idx_historico_clientes_usuario_id ON historico_clientes(usuario_id);
CREATE INDEX idx_historico_clientes_tipo_operacao ON historico_clientes(tipo_operacao);

-- Tabela para configurações de auditoria por lojista
CREATE TABLE configuracoes_auditoria_clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Configurações de retenção
    dias_retencao INTEGER DEFAULT 365,
    max_versoes_por_cliente INTEGER DEFAULT 100,
    
    -- Campos a serem auditados
    campos_auditados JSONB DEFAULT '["nome", "email", "telefone", "cpf", "endereco", "limite_credito", "status"]'::jsonb,
    
    -- Configurações de notificação
    notificar_alteracoes BOOLEAN DEFAULT false,
    emails_notificacao TEXT[],
    
    data_criacao TIMESTAMPTZ DEFAULT now(),
    data_atualizacao TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(lojista_id)
);

-- Função para obter próximo número de versão
CREATE OR REPLACE FUNCTION obter_proxima_versao_cliente(p_cliente_id uuid)
RETURNS INTEGER AS $$
DECLARE
    v_proxima_versao INTEGER;
BEGIN
    SELECT COALESCE(MAX(versao), 0) + 1
    INTO v_proxima_versao
    FROM historico_clientes
    WHERE cliente_id = p_cliente_id;
    
    RETURN v_proxima_versao;
END;
$$ LANGUAGE plpgsql;

-- Função para comparar dados e identificar campos alterados
CREATE OR REPLACE FUNCTION identificar_campos_alterados(
    p_dados_anteriores JSONB,
    p_dados_novos JSONB
) RETURNS TEXT[] AS $$
DECLARE
    v_campos_alterados TEXT[] := '{}';
    v_chave TEXT;
    v_valor_anterior JSONB;
    v_valor_novo JSONB;
BEGIN
    -- Verificar campos que foram alterados ou adicionados
    FOR v_chave IN SELECT jsonb_object_keys(p_dados_novos)
    LOOP
        v_valor_anterior := p_dados_anteriores -> v_chave;
        v_valor_novo := p_dados_novos -> v_chave;
        
        IF v_valor_anterior IS DISTINCT FROM v_valor_novo THEN
            v_campos_alterados := array_append(v_campos_alterados, v_chave);
        END IF;
    END LOOP;
    
    -- Verificar campos que foram removidos
    FOR v_chave IN SELECT jsonb_object_keys(p_dados_anteriores)
    LOOP
        IF NOT (p_dados_novos ? v_chave) THEN
            v_campos_alterados := array_append(v_campos_alterados, v_chave);
        END IF;
    END LOOP;
    
    RETURN v_campos_alterados;
END;
$$ LANGUAGE plpgsql;

-- Função para converter registro de cliente em JSONB
CREATE OR REPLACE FUNCTION cliente_para_jsonb(p_cliente clientes)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'nome', p_cliente.nome,
        'email', p_cliente.email,
        'telefone', p_cliente.telefone,
        'cpf', p_cliente.cpf,
        'endereco', p_cliente.endereco,
        'limite_credito', p_cliente.limite_credito,
        'status', p_cliente.status,
        'data_nascimento', p_cliente.data_nascimento,
        'profissao', p_cliente.profissao,
        'renda_mensal', p_cliente.renda_mensal,
        'score_credito', p_cliente.score_credito
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger function para capturar alterações nos clientes
CREATE OR REPLACE FUNCTION trigger_historico_clientes()
RETURNS TRIGGER AS $$
DECLARE
    v_dados_anteriores JSONB;
    v_dados_novos JSONB;
    v_campos_alterados TEXT[];
    v_versao INTEGER;
    v_usuario_id uuid;
    v_config configuracoes_auditoria_clientes%ROWTYPE;
BEGIN
    -- Obter configurações de auditoria do lojista
    SELECT * INTO v_config
    FROM configuracoes_auditoria_clientes
    WHERE lojista_id = COALESCE(NEW.lojista_id, OLD.lojista_id);
    
    -- Se não há configuração, usar padrões
    IF v_config IS NULL THEN
        INSERT INTO configuracoes_auditoria_clientes (lojista_id)
        VALUES (COALESCE(NEW.lojista_id, OLD.lojista_id))
        RETURNING * INTO v_config;
    END IF;
    
    -- Obter próxima versão
    v_versao := obter_proxima_versao_cliente(COALESCE(NEW.id, OLD.id));
    
    -- Obter usuário atual (se disponível)
    v_usuario_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        v_dados_anteriores := NULL;
        v_dados_novos := cliente_para_jsonb(NEW);
        v_campos_alterados := ARRAY['*']; -- Todos os campos são novos
        
        INSERT INTO historico_clientes (
            cliente_id, versao, dados_anteriores, dados_novos, 
            campos_alterados, tipo_operacao, usuario_id, data_alteracao
        ) VALUES (
            NEW.id, v_versao, v_dados_anteriores, v_dados_novos,
            v_campos_alterados, 'INSERT', v_usuario_id, now()
        );
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_dados_anteriores := cliente_para_jsonb(OLD);
        v_dados_novos := cliente_para_jsonb(NEW);
        v_campos_alterados := identificar_campos_alterados(v_dados_anteriores, v_dados_novos);
        
        -- Só registrar se houve alterações nos campos auditados
        IF array_length(v_campos_alterados, 1) > 0 THEN
            INSERT INTO historico_clientes (
                cliente_id, versao, dados_anteriores, dados_novos,
                campos_alterados, tipo_operacao, usuario_id, data_alteracao
            ) VALUES (
                NEW.id, v_versao, v_dados_anteriores, v_dados_novos,
                v_campos_alterados, 'UPDATE', v_usuario_id, now()
            );
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_dados_anteriores := cliente_para_jsonb(OLD);
        v_dados_novos := NULL;
        v_campos_alterados := ARRAY['*']; -- Todos os campos foram removidos
        
        INSERT INTO historico_clientes (
            cliente_id, versao, dados_anteriores, dados_novos,
            campos_alterados, tipo_operacao, usuario_id, data_alteracao
        ) VALUES (
            OLD.id, v_versao, v_dados_anteriores, v_dados_novos,
            v_campos_alterados, 'DELETE', v_usuario_id, now()
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers para a tabela clientes
DROP TRIGGER IF EXISTS trigger_historico_clientes_insert ON clientes;
DROP TRIGGER IF EXISTS trigger_historico_clientes_update ON clientes;
DROP TRIGGER IF EXISTS trigger_historico_clientes_delete ON clientes;

CREATE TRIGGER trigger_historico_clientes_insert
    AFTER INSERT ON clientes
    FOR EACH ROW EXECUTE FUNCTION trigger_historico_clientes();

CREATE TRIGGER trigger_historico_clientes_update
    AFTER UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION trigger_historico_clientes();

CREATE TRIGGER trigger_historico_clientes_delete
    AFTER DELETE ON clientes
    FOR EACH ROW EXECUTE FUNCTION trigger_historico_clientes();

-- Função para obter histórico completo de um cliente
CREATE OR REPLACE FUNCTION obter_historico_cliente(
    p_cliente_id uuid,
    p_limite INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    versao INTEGER,
    dados_anteriores JSONB,
    dados_novos JSONB,
    campos_alterados TEXT[],
    tipo_operacao VARCHAR(20),
    usuario_id uuid,
    usuario_nome TEXT,
    data_alteracao TIMESTAMPTZ,
    ip_address INET,
    motivo_alteracao TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.versao,
        h.dados_anteriores,
        h.dados_novos,
        h.campos_alterados,
        h.tipo_operacao,
        h.usuario_id,
        COALESCE(u.raw_user_meta_data->>'nome', u.email) as usuario_nome,
        h.data_alteracao,
        h.ip_address,
        h.motivo_alteracao
    FROM historico_clientes h
    LEFT JOIN auth.users u ON h.usuario_id = u.id
    WHERE h.cliente_id = p_cliente_id
    ORDER BY h.data_alteracao DESC, h.versao DESC
    LIMIT p_limite
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para comparar duas versões específicas
CREATE OR REPLACE FUNCTION comparar_versoes_cliente(
    p_cliente_id uuid,
    p_versao_anterior INTEGER,
    p_versao_nova INTEGER
)
RETURNS TABLE (
    campo TEXT,
    valor_anterior JSONB,
    valor_novo JSONB,
    tipo_alteracao TEXT
) AS $$
DECLARE
    v_dados_anteriores JSONB;
    v_dados_novos JSONB;
    v_chave TEXT;
BEGIN
    -- Obter dados das versões
    SELECT dados_novos INTO v_dados_anteriores
    FROM historico_clientes
    WHERE cliente_id = p_cliente_id AND versao = p_versao_anterior;
    
    SELECT dados_novos INTO v_dados_novos
    FROM historico_clientes
    WHERE cliente_id = p_cliente_id AND versao = p_versao_nova;
    
    -- Comparar campos
    FOR v_chave IN SELECT DISTINCT unnest(
        ARRAY(SELECT jsonb_object_keys(v_dados_anteriores)) ||
        ARRAY(SELECT jsonb_object_keys(v_dados_novos))
    )
    LOOP
        IF NOT (v_dados_anteriores ? v_chave) THEN
            -- Campo foi adicionado
            RETURN QUERY SELECT v_chave, NULL::JSONB, v_dados_novos -> v_chave, 'ADICIONADO';
        ELSIF NOT (v_dados_novos ? v_chave) THEN
            -- Campo foi removido
            RETURN QUERY SELECT v_chave, v_dados_anteriores -> v_chave, NULL::JSONB, 'REMOVIDO';
        ELSIF (v_dados_anteriores -> v_chave) IS DISTINCT FROM (v_dados_novos -> v_chave) THEN
            -- Campo foi alterado
            RETURN QUERY SELECT v_chave, v_dados_anteriores -> v_chave, v_dados_novos -> v_chave, 'ALTERADO';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpeza automática de histórico antigo
CREATE OR REPLACE FUNCTION limpar_historico_antigo()
RETURNS INTEGER AS $$
DECLARE
    v_registros_removidos INTEGER := 0;
    v_config RECORD;
BEGIN
    FOR v_config IN 
        SELECT lojista_id, dias_retencao, max_versoes_por_cliente
        FROM configuracoes_auditoria_clientes
    LOOP
        -- Remover registros antigos por data
        DELETE FROM historico_clientes h
        WHERE h.data_alteracao < (now() - (v_config.dias_retencao || ' days')::INTERVAL)
        AND EXISTS (
            SELECT 1 FROM clientes c 
            WHERE c.id = h.cliente_id 
            AND c.lojista_id = v_config.lojista_id
        );
        
        GET DIAGNOSTICS v_registros_removidos = ROW_COUNT;
        
        -- Manter apenas as N versões mais recentes por cliente
        DELETE FROM historico_clientes h1
        WHERE EXISTS (
            SELECT 1 FROM clientes c 
            WHERE c.id = h1.cliente_id 
            AND c.lojista_id = v_config.lojista_id
        )
        AND h1.id NOT IN (
            SELECT h2.id
            FROM historico_clientes h2
            WHERE h2.cliente_id = h1.cliente_id
            ORDER BY h2.versao DESC
            LIMIT v_config.max_versoes_por_cliente
        );
        
        GET DIAGNOSTICS v_registros_removidos = v_registros_removidos + ROW_COUNT;
    END LOOP;
    
    RETURN v_registros_removidos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para estatísticas do histórico
CREATE OR REPLACE FUNCTION estatisticas_historico_cliente(p_lojista_id uuid)
RETURNS TABLE (
    total_alteracoes BIGINT,
    alteracoes_hoje BIGINT,
    alteracoes_semana BIGINT,
    alteracoes_mes BIGINT,
    usuarios_mais_ativos JSONB,
    campos_mais_alterados JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE h.data_alteracao >= CURRENT_DATE) as hoje,
            COUNT(*) FILTER (WHERE h.data_alteracao >= CURRENT_DATE - INTERVAL '7 days') as semana,
            COUNT(*) FILTER (WHERE h.data_alteracao >= CURRENT_DATE - INTERVAL '30 days') as mes
        FROM historico_clientes h
        JOIN clientes c ON h.cliente_id = c.id
        WHERE c.lojista_id = p_lojista_id
    ),
    usuarios_ativos AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'usuario_id', h.usuario_id,
                'usuario_nome', COALESCE(u.raw_user_meta_data->>'nome', u.email),
                'total_alteracoes', COUNT(*)
            ) ORDER BY COUNT(*) DESC
        ) as usuarios
        FROM historico_clientes h
        JOIN clientes c ON h.cliente_id = c.id
        LEFT JOIN auth.users u ON h.usuario_id = u.id
        WHERE c.lojista_id = p_lojista_id
        AND h.data_alteracao >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY h.usuario_id, u.email, u.raw_user_meta_data->>'nome'
        LIMIT 10
    ),
    campos_alterados AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'campo', campo,
                'total_alteracoes', COUNT(*)
            ) ORDER BY COUNT(*) DESC
        ) as campos
        FROM historico_clientes h
        JOIN clientes c ON h.cliente_id = c.id
        CROSS JOIN unnest(h.campos_alterados) as campo
        WHERE c.lojista_id = p_lojista_id
        AND h.data_alteracao >= CURRENT_DATE - INTERVAL '30 days'
        AND campo != '*'
        GROUP BY campo
        LIMIT 10
    )
    SELECT 
        s.total,
        s.hoje,
        s.semana,
        s.mes,
        ua.usuarios,
        ca.campos
    FROM stats s
    CROSS JOIN usuarios_ativos ua
    CROSS JOIN campos_alterados ca;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE historico_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_auditoria_clientes ENABLE ROW LEVEL SECURITY;

-- Policy para historico_clientes
CREATE POLICY "Lojistas podem ver histórico de seus clientes" ON historico_clientes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes c 
            WHERE c.id = cliente_id 
            AND c.lojista_id = auth.uid()
        )
    );

-- Policy para configuracoes_auditoria_clientes
CREATE POLICY "Lojistas podem gerenciar suas configurações de auditoria" ON configuracoes_auditoria_clientes
    FOR ALL USING (lojista_id = auth.uid());

-- Comentários para documentação
COMMENT ON TABLE historico_clientes IS 'Armazena o histórico completo de alterações dos clientes';
COMMENT ON TABLE configuracoes_auditoria_clientes IS 'Configurações de auditoria por lojista';
COMMENT ON FUNCTION obter_historico_cliente IS 'Retorna o histórico paginado de alterações de um cliente';
COMMENT ON FUNCTION comparar_versoes_cliente IS 'Compara duas versões específicas de um cliente';
COMMENT ON FUNCTION limpar_historico_antigo IS 'Remove registros de histórico antigos conforme configuração';
COMMENT ON FUNCTION estatisticas_historico_cliente IS 'Retorna estatísticas do histórico de alterações';