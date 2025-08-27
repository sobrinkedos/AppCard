-- =============================================
-- SISTEMA DE SCORE DE CRÉDITO
-- =============================================

-- Criar enum para tipos de score
CREATE TYPE public.score_type AS ENUM (
  'INICIAL', 'RECALCULADO', 'MANUAL', 'AJUSTADO'
);

-- Criar enum para classificação de risco
CREATE TYPE public.risk_classification AS ENUM (
  'MUITO_BAIXO', 'BAIXO', 'MEDIO', 'ALTO', 'MUITO_ALTO'
);

-- Tabela principal de scores de crédito
CREATE TABLE IF NOT EXISTS public.scores_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  lojista_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Score e classificação
  score_valor integer NOT NULL CHECK (score_valor >= 0 AND score_valor <= 1000),
  classificacao_risco risk_classification NOT NULL,
  tipo_score score_type NOT NULL DEFAULT 'RECALCULADO',
  
  -- Fatores que influenciaram o score
  fatores_positivos jsonb DEFAULT '[]',
  fatores_negativos jsonb DEFAULT '[]',
  
  -- Detalhes do cálculo
  historico_pagamentos_score integer DEFAULT 0,
  utilizacao_limite_score integer DEFAULT 0,
  tempo_relacionamento_score integer DEFAULT 0,
  diversidade_transacoes_score integer DEFAULT 0,
  comportamento_recente_score integer DEFAULT 0,
  
  -- Metadados
  algoritmo_versao varchar(10) NOT NULL DEFAULT 'v1.0',
  observacoes text,
  score_anterior integer,
  variacao_score integer,
  
  -- Validade e controle
  valido_ate timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  recalcular_em timestamptz,
  bloqueado boolean DEFAULT false,
  motivo_bloqueio text,
  
  -- Auditoria
  calculado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Índices
  INDEX idx_scores_cliente_id (cliente_id),
  INDEX idx_scores_lojista_id (lojista_id),
  INDEX idx_scores_validade (valido_ate),
  INDEX idx_scores_classificacao (classificacao_risco),
  INDEX idx_scores_recalculo (recalcular_em) WHERE recalcular_em IS NOT NULL
);

-- Tabela para histórico de scores
CREATE TABLE IF NOT EXISTS public.historico_scores_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência ao score atual
  score_id uuid REFERENCES public.scores_credito(id) ON DELETE CASCADE NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados históricos
  score_valor integer NOT NULL,
  classificacao_risco risk_classification NOT NULL,
  tipo_score score_type NOT NULL,
  algoritmo_versao varchar(10) NOT NULL,
  
  -- Contexto da mudança
  motivo_alteracao text,
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamp
  data_alteracao timestamptz NOT NULL DEFAULT now(),
  
  -- Índices
  INDEX idx_historico_scores_cliente (cliente_id),
  INDEX idx_historico_scores_data (data_alteracao DESC)
);

-- Tabela para configurações de score por lojista
CREATE TABLE IF NOT EXISTS public.configuracoes_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Pesos dos fatores (soma deve ser 100)
  peso_historico_pagamentos integer NOT NULL DEFAULT 35,
  peso_utilizacao_limite integer NOT NULL DEFAULT 25,
  peso_tempo_relacionamento integer NOT NULL DEFAULT 15,
  peso_diversidade_transacoes integer NOT NULL DEFAULT 15,
  peso_comportamento_recente integer NOT NULL DEFAULT 10,
  
  -- Configurações de recálculo
  recalculo_automatico boolean NOT NULL DEFAULT true,
  frequencia_recalculo_dias integer NOT NULL DEFAULT 30,
  
  -- Limites de classificação
  limite_muito_baixo integer NOT NULL DEFAULT 200,
  limite_baixo integer NOT NULL DEFAULT 400,
  limite_medio integer NOT NULL DEFAULT 600,
  limite_alto integer NOT NULL DEFAULT 800,
  -- Acima de 800 = MUITO_ALTO
  
  -- Configurações de alertas
  alertar_score_baixo boolean NOT NULL DEFAULT true,
  alertar_variacao_significativa boolean NOT NULL DEFAULT true,
  variacao_significativa_pontos integer NOT NULL DEFAULT 50,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraint para validar soma dos pesos
  CONSTRAINT check_pesos_soma_100 CHECK (
    peso_historico_pagamentos + peso_utilizacao_limite + 
    peso_tempo_relacionamento + peso_diversidade_transacoes + 
    peso_comportamento_recente = 100
  )
);

-- Função para calcular classificação de risco baseada no score
CREATE OR REPLACE FUNCTION public.calcular_classificacao_risco(
  p_score integer,
  p_lojista_id uuid
) RETURNS risk_classification AS $
DECLARE
  v_config record;
BEGIN
  -- Buscar configurações do lojista
  SELECT * INTO v_config
  FROM public.configuracoes_score
  WHERE lojista_id = p_lojista_id;
  
  -- Se não tem configuração, usar padrões
  IF v_config IS NULL THEN
    IF p_score <= 200 THEN RETURN 'MUITO_BAIXO';
    ELSIF p_score <= 400 THEN RETURN 'BAIXO';
    ELSIF p_score <= 600 THEN RETURN 'MEDIO';
    ELSIF p_score <= 800 THEN RETURN 'ALTO';
    ELSE RETURN 'MUITO_ALTO';
    END IF;
  END IF;
  
  -- Usar configurações personalizadas
  IF p_score <= v_config.limite_muito_baixo THEN RETURN 'MUITO_BAIXO';
  ELSIF p_score <= v_config.limite_baixo THEN RETURN 'BAIXO';
  ELSIF p_score <= v_config.limite_medio THEN RETURN 'MEDIO';
  ELSIF p_score <= v_config.limite_alto THEN RETURN 'ALTO';
  ELSE RETURN 'MUITO_ALTO';
  END IF;
END;
$ LANGUAGE plpgsql;

-- Função principal para calcular score de crédito
CREATE OR REPLACE FUNCTION public.calcular_score_credito(
  p_cliente_id uuid,
  p_lojista_id uuid,
  p_tipo_score score_type DEFAULT 'RECALCULADO'
) RETURNS integer AS $
DECLARE
  v_config record;
  v_score_historico integer := 0;
  v_score_utilizacao integer := 0;
  v_score_tempo integer := 0;
  v_score_diversidade integer := 0;
  v_score_comportamento integer := 0;
  v_score_final integer := 0;
  v_fatores_positivos jsonb := '[]';
  v_fatores_negativos jsonb := '[]';
  
  -- Variáveis para cálculos
  v_total_faturas integer;
  v_faturas_pagas integer;
  v_faturas_atrasadas integer;
  v_dias_relacionamento integer;
  v_utilizacao_media numeric;
  v_tipos_transacao integer;
  v_transacoes_recentes integer;
BEGIN
  -- Buscar configurações
  SELECT * INTO v_config
  FROM public.configuracoes_score
  WHERE lojista_id = p_lojista_id;
  
  -- Se não tem configuração, criar uma padrão
  IF v_config IS NULL THEN
    INSERT INTO public.configuracoes_score (lojista_id)
    VALUES (p_lojista_id)
    RETURNING * INTO v_config;
  END IF;
  
  -- 1. HISTÓRICO DE PAGAMENTOS (35% por padrão)
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'Paga') as pagas,
    COUNT(*) FILTER (WHERE status = 'Atrasada') as atrasadas
  INTO v_total_faturas, v_faturas_pagas, v_faturas_atrasadas
  FROM public.faturas
  WHERE cliente_id = p_cliente_id;
  
  IF v_total_faturas > 0 THEN
    v_score_historico := LEAST(1000, (v_faturas_pagas * 1000 / v_total_faturas));
    
    IF v_faturas_pagas = v_total_faturas THEN
      v_fatores_positivos := v_fatores_positivos || '["Histórico de pagamentos perfeito"]';
    ELSIF v_faturas_atrasadas > v_total_faturas * 0.2 THEN
      v_fatores_negativos := v_fatores_negativos || '["Muitas faturas em atraso"]';
    END IF;
  ELSE
    v_score_historico := 500; -- Score neutro para novos clientes
    v_fatores_positivos := v_fatores_positivos || '["Cliente novo - sem histórico negativo"]';
  END IF;
  
  -- 2. UTILIZAÇÃO DO LIMITE (25% por padrão)
  SELECT AVG(
    CASE 
      WHEN c.limite_credito > 0 THEN (c.limite_credito - COALESCE(saldo_disponivel.saldo, c.limite_credito)) / c.limite_credito * 100
      ELSE 0 
    END
  ) INTO v_utilizacao_media
  FROM public.clientes c
  LEFT JOIN (
    SELECT 
      cliente_id,
      SUM(CASE WHEN status != 'Paga' THEN valor_total ELSE 0 END) as saldo
    FROM public.faturas
    WHERE cliente_id = p_cliente_id
    GROUP BY cliente_id
  ) saldo_disponivel ON c.id = saldo_disponivel.cliente_id
  WHERE c.id = p_cliente_id;
  
  v_utilizacao_media := COALESCE(v_utilizacao_media, 0);
  
  IF v_utilizacao_media <= 30 THEN
    v_score_utilizacao := 1000;
    v_fatores_positivos := v_fatores_positivos || '["Baixa utilização do limite"]';
  ELSIF v_utilizacao_media <= 50 THEN
    v_score_utilizacao := 800;
  ELSIF v_utilizacao_media <= 80 THEN
    v_score_utilizacao := 600;
  ELSIF v_utilizacao_media <= 95 THEN
    v_score_utilizacao := 400;
    v_fatores_negativos := v_fatores_negativos || '["Alta utilização do limite"]';
  ELSE
    v_score_utilizacao := 200;
    v_fatores_negativos := v_fatores_negativos || '["Limite quase esgotado"]';
  END IF;
  
  -- 3. TEMPO DE RELACIONAMENTO (15% por padrão)
  SELECT EXTRACT(days FROM now() - data_cadastro) INTO v_dias_relacionamento
  FROM public.clientes
  WHERE id = p_cliente_id;
  
  v_dias_relacionamento := COALESCE(v_dias_relacionamento, 0);
  
  IF v_dias_relacionamento >= 365 THEN
    v_score_tempo := 1000;
    v_fatores_positivos := v_fatores_positivos || '["Cliente há mais de 1 ano"]';
  ELSIF v_dias_relacionamento >= 180 THEN
    v_score_tempo := 800;
  ELSIF v_dias_relacionamento >= 90 THEN
    v_score_tempo := 600;
  ELSIF v_dias_relacionamento >= 30 THEN
    v_score_tempo := 400;
  ELSE
    v_score_tempo := 200;
  END IF;
  
  -- 4. DIVERSIDADE DE TRANSAÇÕES (15% por padrão)
  SELECT COUNT(DISTINCT categoria) INTO v_tipos_transacao
  FROM public.transacoes
  WHERE cliente_id = p_cliente_id
    AND data_transacao >= now() - interval '6 months';
  
  v_tipos_transacao := COALESCE(v_tipos_transacao, 0);
  
  IF v_tipos_transacao >= 5 THEN
    v_score_diversidade := 1000;
    v_fatores_positivos := v_fatores_positivos || '["Boa diversidade de transações"]';
  ELSIF v_tipos_transacao >= 3 THEN
    v_score_diversidade := 800;
  ELSIF v_tipos_transacao >= 2 THEN
    v_score_diversidade := 600;
  ELSIF v_tipos_transacao >= 1 THEN
    v_score_diversidade := 400;
  ELSE
    v_score_diversidade := 200;
  END IF;
  
  -- 5. COMPORTAMENTO RECENTE (10% por padrão)
  SELECT COUNT(*) INTO v_transacoes_recentes
  FROM public.transacoes
  WHERE cliente_id = p_cliente_id
    AND data_transacao >= now() - interval '30 days';
  
  v_transacoes_recentes := COALESCE(v_transacoes_recentes, 0);
  
  IF v_transacoes_recentes >= 10 THEN
    v_score_comportamento := 1000;
    v_fatores_positivos := v_fatores_positivos || '["Cliente ativo recentemente"]';
  ELSIF v_transacoes_recentes >= 5 THEN
    v_score_comportamento := 800;
  ELSIF v_transacoes_recentes >= 2 THEN
    v_score_comportamento := 600;
  ELSIF v_transacoes_recentes >= 1 THEN
    v_score_comportamento := 400;
  ELSE
    v_score_comportamento := 200;
    v_fatores_negativos := v_fatores_negativos || '["Baixa atividade recente"]';
  END IF;
  
  -- CÁLCULO FINAL COM PESOS
  v_score_final := (
    (v_score_historico * v_config.peso_historico_pagamentos / 100) +
    (v_score_utilizacao * v_config.peso_utilizacao_limite / 100) +
    (v_score_tempo * v_config.peso_tempo_relacionamento / 100) +
    (v_score_diversidade * v_config.peso_diversidade_transacoes / 100) +
    (v_score_comportamento * v_config.peso_comportamento_recente / 100)
  ) / 100;
  
  -- Garantir que está no range 0-1000
  v_score_final := GREATEST(0, LEAST(1000, v_score_final));
  
  RETURN v_score_final;
END;
$ LANGUAGE plpgsql;

-- Função para atualizar ou criar score de um cliente
CREATE OR REPLACE FUNCTION public.atualizar_score_cliente(
  p_cliente_id uuid,
  p_lojista_id uuid,
  p_tipo_score score_type DEFAULT 'RECALCULADO',
  p_observacoes text DEFAULT NULL
) RETURNS uuid AS $
DECLARE
  v_score_atual record;
  v_novo_score integer;
  v_classificacao risk_classification;
  v_score_id uuid;
  v_variacao integer := 0;
BEGIN
  -- Calcular novo score
  v_novo_score := public.calcular_score_credito(p_cliente_id, p_lojista_id, p_tipo_score);
  v_classificacao := public.calcular_classificacao_risco(v_novo_score, p_lojista_id);
  
  -- Buscar score atual
  SELECT * INTO v_score_atual
  FROM public.scores_credito
  WHERE cliente_id = p_cliente_id
    AND lojista_id = p_lojista_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Calcular variação
  IF v_score_atual IS NOT NULL THEN
    v_variacao := v_novo_score - v_score_atual.score_valor;
    
    -- Salvar no histórico
    INSERT INTO public.historico_scores_credito (
      score_id, cliente_id, score_valor, classificacao_risco,
      tipo_score, algoritmo_versao, motivo_alteracao, alterado_por
    ) VALUES (
      v_score_atual.id, p_cliente_id, v_score_atual.score_valor,
      v_score_atual.classificacao_risco, v_score_atual.tipo_score,
      v_score_atual.algoritmo_versao, 'Recálculo automático', auth.uid()
    );
    
    -- Atualizar score existente
    UPDATE public.scores_credito
    SET 
      score_valor = v_novo_score,
      classificacao_risco = v_classificacao,
      tipo_score = p_tipo_score,
      score_anterior = v_score_atual.score_valor,
      variacao_score = v_variacao,
      observacoes = p_observacoes,
      calculado_por = auth.uid(),
      calculado_em = now(),
      updated_at = now(),
      valido_ate = now() + interval '30 days'
    WHERE id = v_score_atual.id
    RETURNING id INTO v_score_id;
  ELSE
    -- Criar novo score
    INSERT INTO public.scores_credito (
      cliente_id, lojista_id, score_valor, classificacao_risco,
      tipo_score, observacoes, calculado_por
    ) VALUES (
      p_cliente_id, p_lojista_id, v_novo_score, v_classificacao,
      p_tipo_score, p_observacoes, auth.uid()
    ) RETURNING id INTO v_score_id;
  END IF;
  
  RETURN v_score_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_scores_credito_updated_at
  BEFORE UPDATE ON public.scores_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_score_updated_at
  BEFORE UPDATE ON public.configuracoes_score
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.scores_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_scores_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_score ENABLE ROW LEVEL SECURITY;

-- Políticas para scores_credito
CREATE POLICY "Lojistas podem ver scores de seus clientes" ON public.scores_credito
  FOR SELECT USING (lojista_id = auth.uid());

CREATE POLICY "Lojistas podem inserir scores de seus clientes" ON public.scores_credito
  FOR INSERT WITH CHECK (lojista_id = auth.uid());

CREATE POLICY "Lojistas podem atualizar scores de seus clientes" ON public.scores_credito
  FOR UPDATE USING (lojista_id = auth.uid());

-- Políticas para histórico
CREATE POLICY "Lojistas podem ver histórico de seus clientes" ON public.historico_scores_credito
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = historico_scores_credito.cliente_id
        AND c.lojista_id = auth.uid()
    )
  );

-- Políticas para configurações
CREATE POLICY "Lojistas podem gerenciar suas configurações" ON public.configuracoes_score
  FOR ALL USING (lojista_id = auth.uid());

-- Inserir configurações padrão para lojistas existentes
INSERT INTO public.configuracoes_score (lojista_id)
SELECT DISTINCT lojista_id
FROM public.clientes
WHERE lojista_id NOT IN (
  SELECT lojista_id FROM public.configuracoes_score
)
ON CONFLICT (lojista_id) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE public.scores_credito IS 'Scores de crédito dos clientes com versionamento';
COMMENT ON TABLE public.historico_scores_credito IS 'Histórico de alterações nos scores de crédito';
COMMENT ON TABLE public.configuracoes_score IS 'Configurações personalizáveis de cálculo de score por lojista';

COMMENT ON FUNCTION public.calcular_score_credito IS 'Calcula score de crédito baseado em múltiplos fatores';
COMMENT ON FUNCTION public.atualizar_score_cliente IS 'Atualiza ou cria score de um cliente com histórico';
COMMENT ON FUNCTION public.calcular_classificacao_risco IS 'Determina classificação de risco baseada no score';