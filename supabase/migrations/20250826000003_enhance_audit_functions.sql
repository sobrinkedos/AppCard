-- Funções SQL avançadas para o sistema de auditoria

-- Função para obter tendências de atividade
CREATE OR REPLACE FUNCTION public.get_activity_trends(
  p_lojista_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_interval text DEFAULT 'day'
)
RETURNS TABLE (
  period text,
  total_events bigint,
  success_events bigint,
  failure_events bigint,
  suspicious_events bigint,
  avg_risk_score numeric
) AS $$
DECLARE
  v_date_trunc_format text;
BEGIN
  -- Determinar formato de agrupamento baseado no intervalo
  CASE p_interval
    WHEN 'hour' THEN v_date_trunc_format := 'hour';
    WHEN 'day' THEN v_date_trunc_format := 'day';
    WHEN 'week' THEN v_date_trunc_format := 'week';
    ELSE v_date_trunc_format := 'day';
  END CASE;

  RETURN QUERY
  SELECT 
    date_trunc(v_date_trunc_format, l.timestamp)::text as period,
    COUNT(*)::bigint as total_events,
    COUNT(*) FILTER (WHERE l.status = 'SUCCESS')::bigint as success_events,
    COUNT(*) FILTER (WHERE l.status IN ('FAILURE', 'ERROR'))::bigint as failure_events,
    COUNT(*) FILTER (WHERE l.is_suspicious = true)::bigint as suspicious_events,
    AVG(l.risk_score)::numeric as avg_risk_score
  FROM public.logs_auditoria l
  WHERE l.lojista_id = p_lojista_id
    AND l.timestamp >= p_start_date
    AND l.timestamp <= p_end_date
  GROUP BY date_trunc(v_date_trunc_format, l.timestamp)
  ORDER BY period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para detectar anomalias de atividade
CREATE OR REPLACE FUNCTION public.detect_activity_anomalies(
  p_lojista_id uuid,
  p_hours integer DEFAULT 24
)
RETURNS TABLE (
  anomaly_type text,
  description text,
  severity audit_severity,
  affected_user uuid,
  event_count bigint,
  time_window text,
  metadata jsonb
) AS $$
DECLARE
  v_threshold_time timestamptz := now() - (p_hours || ' hours')::interval;
  v_normal_baseline numeric;
  v_current_activity bigint;
BEGIN
  -- Calcular baseline normal (média dos últimos 7 dias, excluindo período atual)
  SELECT AVG(daily_count) INTO v_normal_baseline
  FROM (
    SELECT COUNT(*) as daily_count
    FROM public.logs_auditoria
    WHERE lojista_id = p_lojista_id
      AND timestamp >= (now() - interval '7 days')
      AND timestamp < v_threshold_time
    GROUP BY date_trunc('day', timestamp)
  ) baseline;

  -- Obter atividade atual
  SELECT COUNT(*) INTO v_current_activity
  FROM public.logs_auditoria
  WHERE lojista_id = p_lojista_id
    AND timestamp >= v_threshold_time;

  -- Detectar pico de atividade (mais de 3x o normal)
  IF v_current_activity > (v_normal_baseline * 3) THEN
    RETURN QUERY SELECT 
      'ACTIVITY_SPIKE'::text,
      'Pico de atividade detectado: ' || v_current_activity || ' eventos vs baseline de ' || COALESCE(v_normal_baseline::text, '0'),
      'HIGH'::audit_severity,
      NULL::uuid,
      v_current_activity,
      p_hours || ' horas',
      jsonb_build_object(
        'current_activity', v_current_activity,
        'baseline', v_normal_baseline,
        'multiplier', CASE WHEN v_normal_baseline > 0 THEN v_current_activity / v_normal_baseline ELSE 0 END
      );
  END IF;

  -- Detectar usuários com atividade anômala
  RETURN QUERY
  SELECT 
    'USER_ANOMALY'::text,
    'Usuário com atividade anômala: ' || user_activity.usuario_id || ' (' || user_activity.event_count || ' eventos)',
    CASE 
      WHEN user_activity.event_count > 100 THEN 'CRITICAL'::audit_severity
      WHEN user_activity.event_count > 50 THEN 'HIGH'::audit_severity
      ELSE 'MEDIUM'::audit_severity
    END,
    user_activity.usuario_id,
    user_activity.event_count,
    p_hours || ' horas',
    jsonb_build_object(
      'actions_breakdown', user_activity.actions,
      'suspicious_count', user_activity.suspicious_count,
      'unique_ips', user_activity.unique_ips
    )
  FROM (
    SELECT 
      l.usuario_id,
      COUNT(*) as event_count,
      COUNT(*) FILTER (WHERE l.is_suspicious) as suspicious_count,
      COUNT(DISTINCT l.ip_address) as unique_ips,
      jsonb_object_agg(l.action, action_counts.count) as actions
    FROM public.logs_auditoria l
    LEFT JOIN (
      SELECT usuario_id, action, COUNT(*) as count
      FROM public.logs_auditoria
      WHERE lojista_id = p_lojista_id
        AND timestamp >= v_threshold_time
        AND usuario_id IS NOT NULL
      GROUP BY usuario_id, action
    ) action_counts ON l.usuario_id = action_counts.usuario_id
    WHERE l.lojista_id = p_lojista_id
      AND l.timestamp >= v_threshold_time
      AND l.usuario_id IS NOT NULL
    GROUP BY l.usuario_id
    HAVING COUNT(*) > 30 -- Threshold para atividade anômala
  ) user_activity;

  -- Detectar padrões de IP suspeitos
  RETURN QUERY
  SELECT 
    'SUSPICIOUS_IP_PATTERN'::text,
    'Padrão de IP suspeito detectado: ' || ip_patterns.ip_address || ' (' || ip_patterns.user_count || ' usuários diferentes)',
    'HIGH'::audit_severity,
    NULL::uuid,
    ip_patterns.event_count,
    p_hours || ' horas',
    jsonb_build_object(
      'ip_address', ip_patterns.ip_address,
      'user_count', ip_patterns.user_count,
      'users', ip_patterns.users
    )
  FROM (
    SELECT 
      l.ip_address,
      COUNT(*) as event_count,
      COUNT(DISTINCT l.usuario_id) as user_count,
      array_agg(DISTINCT l.usuario_id) as users
    FROM public.logs_auditoria l
    WHERE l.lojista_id = p_lojista_id
      AND l.timestamp >= v_threshold_time
      AND l.ip_address IS NOT NULL
      AND l.usuario_id IS NOT NULL
    GROUP BY l.ip_address
    HAVING COUNT(DISTINCT l.usuario_id) > 5 -- Mesmo IP para muitos usuários
  ) ip_patterns;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular score de risco dinâmico
CREATE OR REPLACE FUNCTION public.calculate_dynamic_risk_score(
  p_lojista_id uuid,
  p_usuario_id uuid,
  p_action audit_action_type,
  p_resource_type text,
  p_ip_address inet DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_base_score integer := 0;
  v_user_history_score integer := 0;
  v_time_score integer := 0;
  v_ip_score integer := 0;
  v_frequency_score integer := 0;
  v_final_score integer;
BEGIN
  -- Score base por tipo de ação
  CASE p_action
    WHEN 'DELETE' THEN v_base_score := 40;
    WHEN 'EXPORT' THEN v_base_score := 35;
    WHEN 'DECRYPT' THEN v_base_score := 30;
    WHEN 'SUSPEND', 'ACTIVATE' THEN v_base_score := 25;
    WHEN 'UPDATE' THEN v_base_score := 15;
    WHEN 'CREATE' THEN v_base_score := 10;
    ELSE v_base_score := 5;
  END CASE;

  -- Score baseado no histórico do usuário (últimos 30 dias)
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE is_suspicious) > 5 THEN 20
      WHEN COUNT(*) FILTER (WHERE is_suspicious) > 2 THEN 15
      WHEN COUNT(*) FILTER (WHERE is_suspicious) > 0 THEN 10
      ELSE 0
    END INTO v_user_history_score
  FROM public.logs_auditoria
  WHERE lojista_id = p_lojista_id
    AND usuario_id = p_usuario_id
    AND timestamp >= now() - interval '30 days';

  -- Score baseado no horário (fora do horário comercial)
  SELECT 
    CASE 
      WHEN EXTRACT(hour FROM now()) BETWEEN 22 AND 23 OR EXTRACT(hour FROM now()) BETWEEN 0 AND 6 THEN 15
      WHEN EXTRACT(dow FROM now()) IN (0, 6) THEN 10 -- Fim de semana
      ELSE 0
    END INTO v_time_score;

  -- Score baseado no IP (se fornecido)
  IF p_ip_address IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN COUNT(DISTINCT usuario_id) > 10 THEN 20 -- IP usado por muitos usuários
        WHEN COUNT(DISTINCT usuario_id) > 5 THEN 15
        WHEN COUNT(DISTINCT usuario_id) > 2 THEN 10
        ELSE 0
      END INTO v_ip_score
    FROM public.logs_auditoria
    WHERE lojista_id = p_lojista_id
      AND ip_address = p_ip_address
      AND timestamp >= now() - interval '7 days';
  END IF;

  -- Score baseado na frequência de ações (últimas 2 horas)
  SELECT 
    CASE 
      WHEN COUNT(*) > 50 THEN 25
      WHEN COUNT(*) > 30 THEN 20
      WHEN COUNT(*) > 20 THEN 15
      WHEN COUNT(*) > 10 THEN 10
      ELSE 0
    END INTO v_frequency_score
  FROM public.logs_auditoria
  WHERE lojista_id = p_lojista_id
    AND usuario_id = p_usuario_id
    AND timestamp >= now() - interval '2 hours';

  -- Calcular score final
  v_final_score := v_base_score + v_user_history_score + v_time_score + v_ip_score + v_frequency_score;

  -- Limitar entre 0 e 100
  RETURN LEAST(GREATEST(v_final_score, 0), 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar relatório de compliance
CREATE OR REPLACE FUNCTION public.generate_compliance_report(
  p_lojista_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  metric_name text,
  metric_value text,
  compliance_status text,
  details jsonb
) AS $$
BEGIN
  -- Total de eventos auditados
  RETURN QUERY SELECT 
    'total_events'::text,
    COUNT(*)::text,
    'COMPLIANT'::text,
    jsonb_build_object('period', p_start_date || ' to ' || p_end_date)
  FROM public.logs_auditoria
  WHERE lojista_id = p_lojista_id
    AND timestamp BETWEEN p_start_date AND p_end_date;

  -- Eventos de acesso a dados sensíveis
  RETURN QUERY SELECT 
    'sensitive_data_access'::text,
    COUNT(*)::text,
    CASE WHEN COUNT(*) > 0 THEN 'REQUIRES_REVIEW' ELSE 'COMPLIANT' END,
    jsonb_build_object(
      'decrypt_actions', COUNT(*) FILTER (WHERE action = 'DECRYPT'),
      'export_actions', COUNT(*) FILTER (WHERE action = 'EXPORT'),
      'unmask_actions', COUNT(*) FILTER (WHERE action = 'UNMASK')
    )
  FROM public.logs_auditoria
  WHERE lojista_id = p_lojista_id
    AND timestamp BETWEEN p_start_date AND p_end_date
    AND action IN ('DECRYPT', 'EXPORT', 'UNMASK');

  -- Eventos suspeitos
  RETURN QUERY SELECT 
    'suspicious_events'::text,
    COUNT(*)::text,
    CASE WHEN COUNT(*) > 10 THEN 'NON_COMPLIANT' WHEN COUNT(*) > 0 THEN 'REQUIRES_REVIEW' ELSE 'COMPLIANT' END,
    jsonb_build_object(
      'high_risk_events', COUNT(*) FILTER (WHERE risk_score >= 70),
      'unresolved_alerts', (
        SELECT COUNT(*) FROM public.audit_alerts aa
        JOIN public.logs_auditoria la ON aa.log_id = la.id
        WHERE la.lojista_id = p_lojista_id
          AND aa.status = 'OPEN'
          AND aa.triggered_at BETWEEN p_start_date AND p_end_date
      )
    )
  FROM public.logs_auditoria
  WHERE lojista_id = p_lojista_id
    AND timestamp BETWEEN p_start_date AND p_end_date
    AND is_suspicious = true;

  -- Retenção de dados
  RETURN QUERY SELECT 
    'data_retention'::text,
    (
      SELECT log_retention_days::text 
      FROM public.audit_config 
      WHERE lojista_id = p_lojista_id
    ),
    CASE 
      WHEN (SELECT log_retention_days FROM public.audit_config WHERE lojista_id = p_lojista_id) >= 365 THEN 'COMPLIANT'
      ELSE 'NON_COMPLIANT'
    END,
    jsonb_build_object(
      'oldest_log', (
        SELECT MIN(timestamp) FROM public.logs_auditoria WHERE lojista_id = p_lojista_id
      ),
      'total_stored_days', (
        SELECT EXTRACT(days FROM now() - MIN(timestamp)) 
        FROM public.logs_auditoria 
        WHERE lojista_id = p_lojista_id
      )
    );

  -- Cobertura de auditoria por recurso
  RETURN QUERY SELECT 
    'audit_coverage'::text,
    COUNT(DISTINCT resource_type)::text || ' resource types',
    'COMPLIANT'::text,
    jsonb_object_agg(resource_type, resource_count)
  FROM (
    SELECT 
      resource_type,
      COUNT(*) as resource_count
    FROM public.logs_auditoria
    WHERE lojista_id = p_lojista_id
      AND timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY resource_type
  ) resource_stats;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpeza inteligente de logs
CREATE OR REPLACE FUNCTION public.intelligent_log_cleanup(
  p_lojista_id uuid DEFAULT NULL
)
RETURNS TABLE (
  lojista_id uuid,
  logs_archived integer,
  logs_deleted integer,
  space_freed_mb numeric
) AS $$
DECLARE
  config_record record;
  v_logs_archived integer := 0;
  v_logs_deleted integer := 0;
  v_space_freed numeric := 0;
BEGIN
  -- Se lojista específico não fornecido, processar todos
  FOR config_record IN
    SELECT ac.lojista_id, ac.log_retention_days, ac.compliance_mode
    FROM public.audit_config ac
    WHERE (p_lojista_id IS NULL OR ac.lojista_id = p_lojista_id)
  LOOP
    -- Arquivar logs importantes antes de deletar
    WITH archived AS (
      UPDATE public.logs_auditoria
      SET is_archived = true,
          retention_until = now() + interval '7 years' -- Retenção estendida para logs importantes
      WHERE lojista_id = config_record.lojista_id
        AND timestamp < now() - (config_record.log_retention_days || ' days')::interval
        AND (
          severity IN ('HIGH', 'CRITICAL') OR
          is_suspicious = true OR
          requires_review = true OR
          action IN ('DELETE', 'EXPORT', 'DECRYPT')
        )
        AND NOT is_archived
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_logs_archived FROM archived;

    -- Deletar logs antigos não críticos
    WITH deleted AS (
      DELETE FROM public.logs_auditoria
      WHERE lojista_id = config_record.lojista_id
        AND timestamp < now() - (config_record.log_retention_days || ' days')::interval
        AND NOT is_archived
        AND NOT requires_review
        AND severity = 'LOW'
        AND NOT is_suspicious
      RETURNING octet_length(old_values::text) + octet_length(new_values::text) + octet_length(description) as size_bytes
    )
    SELECT COUNT(*), COALESCE(SUM(size_bytes), 0) / (1024 * 1024) 
    INTO v_logs_deleted, v_space_freed 
    FROM deleted;

    RETURN QUERY SELECT 
      config_record.lojista_id,
      v_logs_archived,
      v_logs_deleted,
      v_space_freed;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para calcular score de risco dinamicamente
CREATE OR REPLACE FUNCTION public.update_risk_score_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular score de risco dinâmico
  NEW.risk_score := public.calculate_dynamic_risk_score(
    NEW.lojista_id,
    NEW.usuario_id,
    NEW.action,
    NEW.resource_type,
    NEW.ip_address
  );

  -- Marcar como suspeito se score alto
  IF NEW.risk_score >= 60 THEN
    NEW.is_suspicious := true;
  END IF;

  -- Marcar para revisão se score muito alto
  IF NEW.risk_score >= 80 THEN
    NEW.requires_review := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela de logs
DROP TRIGGER IF EXISTS calculate_risk_score_trigger ON public.logs_auditoria;
CREATE TRIGGER calculate_risk_score_trigger
  BEFORE INSERT ON public.logs_auditoria
  FOR EACH ROW
  EXECUTE FUNCTION public.update_risk_score_trigger();

-- Função para estatísticas de performance do sistema de auditoria
CREATE OR REPLACE FUNCTION public.get_audit_system_stats()
RETURNS TABLE (
  metric text,
  value text,
  status text
) AS $$
BEGIN
  -- Total de logs no sistema
  RETURN QUERY SELECT 
    'total_logs'::text,
    COUNT(*)::text,
    'INFO'::text
  FROM public.logs_auditoria;

  -- Logs processados nas últimas 24h
  RETURN QUERY SELECT 
    'logs_last_24h'::text,
    COUNT(*)::text,
    CASE WHEN COUNT(*) > 10000 THEN 'WARNING' ELSE 'OK' END
  FROM public.logs_auditoria
  WHERE timestamp >= now() - interval '24 hours';

  -- Alertas ativos
  RETURN QUERY SELECT 
    'active_alerts'::text,
    COUNT(*)::text,
    CASE WHEN COUNT(*) > 50 THEN 'CRITICAL' WHEN COUNT(*) > 10 THEN 'WARNING' ELSE 'OK' END
  FROM public.audit_alerts
  WHERE status = 'OPEN';

  -- Tamanho da tabela de logs
  RETURN QUERY SELECT 
    'logs_table_size'::text,
    pg_size_pretty(pg_total_relation_size('public.logs_auditoria')),
    CASE 
      WHEN pg_total_relation_size('public.logs_auditoria') > 1073741824 THEN 'WARNING' -- > 1GB
      ELSE 'OK' 
    END;

  -- Performance média de inserção
  RETURN QUERY SELECT 
    'avg_insert_time'::text,
    COALESCE(AVG(duration_ms)::text, 'N/A') || ' ms',
    CASE 
      WHEN AVG(duration_ms) > 100 THEN 'WARNING'
      WHEN AVG(duration_ms) > 50 THEN 'CAUTION'
      ELSE 'OK'
    END
  FROM public.logs_auditoria
  WHERE timestamp >= now() - interval '1 hour'
    AND duration_ms IS NOT NULL;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants para as novas funções
GRANT EXECUTE ON FUNCTION public.get_activity_trends TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_activity_anomalies TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_dynamic_risk_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_compliance_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.intelligent_log_cleanup TO service_role;
GRANT EXECUTE ON FUNCTION public.get_audit_system_stats TO authenticated;

-- Comentários para documentação
COMMENT ON FUNCTION public.get_activity_trends IS 'Obtém tendências de atividade de auditoria por período';
COMMENT ON FUNCTION public.detect_activity_anomalies IS 'Detecta padrões anômalos na atividade de auditoria';
COMMENT ON FUNCTION public.calculate_dynamic_risk_score IS 'Calcula score de risco dinâmico baseado em múltiplos fatores';
COMMENT ON FUNCTION public.generate_compliance_report IS 'Gera relatório de compliance para auditoria';
COMMENT ON FUNCTION public.intelligent_log_cleanup IS 'Limpeza inteligente de logs com arquivamento de dados críticos';
COMMENT ON FUNCTION public.get_audit_system_stats IS 'Obtém estatísticas de performance do sistema de auditoria';