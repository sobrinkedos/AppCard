// Tipos para o sistema de auditoria

export type AuditActionType = 
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT'
  | 'ENCRYPT' | 'DECRYPT' | 'MASK' | 'UNMASK'
  | 'APPROVE' | 'REJECT' | 'SUSPEND' | 'ACTIVATE';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'ERROR';

export interface AuditLogEntry {
  id?: string;
  timestamp?: string;
  lojista_id?: string;
  usuario_id?: string;
  session_id?: string;
  
  // Detalhes da ação
  action: AuditActionType;
  resource_type: string;
  resource_id?: string;
  description: string;
  
  // Contexto técnico
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  request_params?: Record<string, any>;
  
  // Dados da mudança
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changed_fields?: string[];
  
  // Classificação
  severity?: AuditSeverity;
  status?: AuditStatus;
  category?: string;
  tags?: string[];
  
  // Contexto de segurança
  risk_score?: number;
  is_suspicious?: boolean;
  requires_review?: boolean;
  
  // Metadados
  correlation_id?: string;
  parent_log_id?: string;
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;
}

export interface AuditAlert {
  id: string;
  log_id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: AuditSeverity;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  assigned_to?: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
  resolution_notes?: string;
}

export interface AuditConfig {
  id?: string;
  lojista_id: string;
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  log_retention_days: number;
  enable_alerts: boolean;
  alert_thresholds: Record<string, any>;
  notification_channels: string[];
  compliance_mode: boolean;
  required_fields: string[];
  batch_size: number;
  async_logging: boolean;
}

export interface AuditMetrics {
  id?: string;
  lojista_id: string;
  period_start: string;
  period_end: string;
  
  // Contadores
  total_events: number;
  success_events: number;
  failure_events: number;
  warning_events: number;
  
  // Por severidade
  low_severity: number;
  medium_severity: number;
  high_severity: number;
  critical_severity: number;
  
  // Por tipo de ação
  create_actions: number;
  read_actions: number;
  update_actions: number;
  delete_actions: number;
  
  // Métricas de segurança
  suspicious_events: number;
  failed_logins: number;
  data_exports: number;
  
  // Performance
  avg_response_time_ms?: number;
  max_response_time_ms?: number;
}

export interface AuditFilter {
  start_date?: string;
  end_date?: string;
  usuario_id?: string;
  action?: AuditActionType;
  resource_type?: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
  is_suspicious?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditContext {
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
  request_path?: string;
  request_method?: string;
}