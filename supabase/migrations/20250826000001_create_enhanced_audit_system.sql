-- =============================================
-- SISTEMA AVANÇADO DE LOGS E AUDITORIA
-- =============================================

-- Criar tipos para o sistema de auditoria
CREATE TYPE public.audit_action_type AS ENUM (
  'CREATE', 'READ', 'UPDATE', 'DELETE', 
  'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT',
  'ENCRYPT', 'DECRYPT', 'MASK', 'UNMASK',
  'APPROVE', 'REJECT', 'SUSPEND', 'ACTIVATE'
);

CREATE TYPE public.audit_severity AS ENUM (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);

CREATE TYPE public.audit_status AS ENUM (
  'SUCCESS', 'FAILURE', 'WARNING', 'ERROR'
);

-- Tabela principal de auditoria expandida
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informações básicas
  timestamp timestamptz NOT NULL DEFAULT now(),
  lojista_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  
  -- Detalhes da ação
  action audit_action_type NOT NULL,
  resource_type text NOT NULL, -- 'cliente', 'cartao', 'transacao', etc.
  resource_id uuid,
  description text NOT NULL,
  
  -- Contexto técnico
  ip_address inet,
  user_agent text,
  request_method text,
  request_path text,
  request_params jsonb,
  
  -- Dados da mudança
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  
  -- Classificação
  severity audit_severity NOT NULL DEFAULT 'LOW',
  status audit_status NOT NULL DEFAULT 'SUCCESS',
  category text,
  tags text[],
  
  -- Contexto de segurança
  risk_score integer CHECK (risk_score >= 0 AND risk_score <= 100),
  is_suspicious boolean DEFAULT false,
  requires_review boolean DEFAULT false,
  
  -- Metadados
  correlation_id uuid, -- Para agrupar ações relacionadas
  parent_log_id uuid REFERENCES public.logs_auditoria(id),
  duration_ms integer,
  error_message text,
  stack_trace text,
  
  -- Compliance e retenção
  retention_until timestamptz,
  is_archived boolean DEFAULT false,
  compliance_flags text[],
  
  -- Índices para performance
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela para alertas de auditoria
CREATE TABLE IF NOT EXISTS public.audit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid REFERENCES public.logs_auditoria(id) ON DELETE CASCADE,
  
  alert_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity audit_severity NOT NULL,
  
  -- Status do alerta
  status text NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  triggered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  
  -- Metadados
  metadata jsonb,
  resolution_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela para configurações de auditoria
CREATE TABLE IF NOT EXISTS public.audit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Configurações de logging
  log_level text NOT NULL DEFAULT 'INFO', -- DEBUG, INFO, WARN, ERROR
  log_retention_days integer NOT NULL DEFAULT 365,
  
  -- Configurações de alertas
  enable_alerts boolean NOT NULL DEFAULT true,
  alert_thresholds jsonb NOT NULL DEFAULT '{}',
  notification_channels jsonb NOT NULL DEFAULT '[]',
  
  -- Configurações de compliance
  compliance_mode boolean NOT NULL DEFAULT false,
  required_fields text[] NOT NULL DEFAULT '{}',
  
  -- Configurações de performance
  batch_size integer NOT NULL DEFAULT 100,
  async_logging boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela para métricas de auditoria
CREATE TABLE IF NOT EXISTS public.audit_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Período da métrica
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  
  -- Contadores
  total_events integer NOT NULL DEFAULT 0,
  success_events integer NOT NULL DEFAULT 0,
  failure_events integer NOT NULL DEFAULT 0,
  warning_events integer NOT NULL DEFAULT 0,
  
  -- Por severidade
  low_severity integer NOT NULL DEFAULT 0,
  medium_severity integer NOT NULL DEFAULT 0,
  high_severity integer NOT NULL DEFAULT 0,
  critical_severity integer NOT NULL DEFAULT 0,
  
  -- Por tipo de ação
  create_actions integer NOT NULL DEFAULT 0,
  read_actions integer NOT NULL DEFAULT 0,
  update_actions integer NOT NULL DEFAULT 0,
  delete_actions integer NOT NULL DEFAULT 0,
  
  -- Métricas de segurança
  suspicious_events integer NOT NULL DEFAULT 0,
  failed_logins integer NOT NULL DEFAULT 0,
  data_exports integer NOT NULL DEFAULT 0,
  
  -- Performance
  avg_response_time_ms numeric(10,2),
  max_response_time_ms integer,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_timestamp ON public.logs_auditoria(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_lojista_id ON public.logs_auditoria(lojista_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario_id ON public.logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_action ON public.logs_auditoria(action);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_resource ON public.logs_auditoria(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_severity ON public.logs_auditoria(severity);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_suspicious ON public.logs_auditoria(is_suspicious) WHERE is_suspicious = true;
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_correlation ON public.logs_auditoria(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_alerts_status ON public.audit_alerts(status);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON public.audit_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_triggered ON public.audit_alerts(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_metrics_period ON public.audit_metrics(lojista_id, period_start, period_end);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_logs_auditoria_updated_at 
  BEFORE UPDATE ON public.logs_auditoria 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audit_alerts_updated_at 
  BEFORE UPDATE ON public.audit_alerts 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audit_config_updated_at 
  BEFORE UPDATE ON public.audit_config 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para logging automático
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_lojista_id uuid,
  p_usuario_id uuid DEFAULT NULL,
  p_action audit_action_type,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_description text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_severity audit_severity DEFAULT 'LOW',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_changed_fields text[];
  v_risk_score integer := 0;
  v_is_suspicious boolean := false;
BEGIN
  -- Calcular campos alterados
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT array_agg(key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(p_old_values)
      EXCEPT
      SELECT key FROM jsonb_each(p_new_values)
      UNION
      SELECT key FROM jsonb_each(p_new_values)
      EXCEPT
      SELECT key FROM jsonb_each(p_old_values)
    ) AS changed;
  END IF;
  
  -- Calcular score de risco básico
  CASE p_action
    WHEN 'DELETE' THEN v_risk_score := 30;
    WHEN 'EXPORT' THEN v_risk_score := 25;
    WHEN 'DECRYPT' THEN v_risk_score := 20;
    WHEN 'UPDATE' THEN v_risk_score := 15;
    WHEN 'CREATE' THEN v_risk_score := 10;
    ELSE v_risk_score := 5;
  END CASE;
  
  -- Aumentar risco para ações críticas
  IF p_severity IN ('HIGH', 'CRITICAL') THEN
    v_risk_score := v_risk_score + 20;
  END IF;
  
  -- Marcar como suspeito se score alto
  IF v_risk_score >= 40 THEN
    v_is_suspicious := true;
  END IF;
  
  -- Inserir log
  INSERT INTO public.logs_auditoria (
    lojista_id, usuario_id, action, resource_type, resource_id,
    description, old_values, new_values, changed_fields,
    severity, ip_address, user_agent, session_id,
    correlation_id, risk_score, is_suspicious
  ) VALUES (
    p_lojista_id, p_usuario_id, p_action, p_resource_type, p_resource_id,
    p_description, p_old_values, p_new_values, v_changed_fields,
    p_severity, p_ip_address, p_user_agent, p_session_id,
    p_correlation_id, v_risk_score, v_is_suspicious
  ) RETURNING id INTO v_log_id;
  
  -- Verificar se precisa gerar alerta
  IF v_is_suspicious OR p_severity = 'CRITICAL' THEN
    INSERT INTO public.audit_alerts (
      log_id, alert_type, title, message, severity
    ) VALUES (
      v_log_id,
      CASE WHEN v_is_suspicious THEN 'SUSPICIOUS_ACTIVITY' ELSE 'CRITICAL_ACTION' END,
      'Atividade ' || CASE WHEN v_is_suspicious THEN 'Suspeita' ELSE 'Crítica' END || ' Detectada',
      'Ação ' || p_action || ' em ' || p_resource_type || ': ' || p_description,
      p_severity
    );
  END IF;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para detectar padrões suspeitos
CREATE OR REPLACE FUNCTION public.detect_suspicious_patterns()
RETURNS void AS $$
DECLARE
  v_threshold_time interval := '5 minutes';
  v_max_actions integer := 10;
  suspicious_user record;
BEGIN
  -- Detectar usuários com muitas ações em pouco tempo
  FOR suspicious_user IN
    SELECT 
      usuario_id,
      lojista_id,
      COUNT(*) as action_count,
      array_agg(DISTINCT action) as actions
    FROM public.logs_auditoria
    WHERE timestamp > now() - v_threshold_time
      AND usuario_id IS NOT NULL
    GROUP BY usuario_id, lojista_id
    HAVING COUNT(*) > v_max_actions
  LOOP
    -- Marcar logs como suspeitos
    UPDATE public.logs_auditoria
    SET is_suspicious = true,
        risk_score = LEAST(risk_score + 30, 100)
    WHERE usuario_id = suspicious_user.usuario_id
      AND timestamp > now() - v_threshold_time
      AND NOT is_suspicious;
    
    -- Criar alerta
    INSERT INTO public.audit_alerts (
      alert_type, title, message, severity
    ) VALUES (
      'RATE_LIMIT_EXCEEDED',
      'Limite de Ações Excedido',
      'Usuário ' || suspicious_user.usuario_id || ' executou ' || 
      suspicious_user.action_count || ' ações em ' || v_threshold_time,
      'HIGH'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer := 0;
  config_record record;
BEGIN
  -- Para cada lojista, limpar logs baseado na configuração
  FOR config_record IN
    SELECT lojista_id, log_retention_days
    FROM public.audit_config
  LOOP
    WITH deleted AS (
      DELETE FROM public.logs_auditoria
      WHERE lojista_id = config_record.lojista_id
        AND timestamp < now() - (config_record.log_retention_days || ' days')::interval
        AND NOT requires_review
        AND NOT is_archived
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  END LOOP;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas para logs_auditoria
CREATE POLICY "Lojistas podem ver seus próprios logs" ON public.logs_auditoria
  FOR SELECT USING (
    lojista_id = auth.uid() OR
    usuario_id = auth.uid()
  );

CREATE POLICY "Sistema pode inserir logs" ON public.logs_auditoria
  FOR INSERT WITH CHECK (true);

-- Políticas para audit_alerts
CREATE POLICY "Lojistas podem ver seus próprios alertas" ON public.audit_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.logs_auditoria l
      WHERE l.id = audit_alerts.log_id
        AND l.lojista_id = auth.uid()
    )
  );

-- Políticas para audit_config
CREATE POLICY "Lojistas podem gerenciar sua configuração" ON public.audit_config
  FOR ALL USING (lojista_id = auth.uid());

-- Políticas para audit_metrics
CREATE POLICY "Lojistas podem ver suas métricas" ON public.audit_metrics
  FOR SELECT USING (lojista_id = auth.uid());

-- Inserir configuração padrão para usuários existentes
INSERT INTO public.audit_config (lojista_id)
SELECT id FROM auth.users
ON CONFLICT (lojista_id) DO NOTHING;