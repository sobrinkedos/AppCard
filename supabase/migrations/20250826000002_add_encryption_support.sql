-- Migração para suporte a criptografia de dados sensíveis
-- Esta migração adiciona suporte para armazenar dados criptografados

-- Função para verificar se um campo contém dados criptografados
CREATE OR REPLACE FUNCTION is_encrypted_data(data_field TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se o campo parece ser um JSON com estrutura de dados criptografados
  BEGIN
    -- Tenta fazer parse do JSON e verificar se tem as chaves necessárias
    IF data_field IS NULL OR data_field = '' THEN
      RETURN FALSE;
    END IF;
    
    -- Se conseguir fazer parse como JSON e tiver as chaves de criptografia, é criptografado
    RETURN (
      data_field::jsonb ? 'encrypted' AND 
      data_field::jsonb ? 'iv' AND 
      data_field::jsonb ? 'algorithm'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Se não conseguir fazer parse como JSON, não é criptografado
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Função para extrair dados mascarados de campos criptografados
CREATE OR REPLACE FUNCTION get_masked_data(data_field TEXT)
RETURNS TEXT AS $$
BEGIN
  IF is_encrypted_data(data_field) THEN
    -- Extrai o valor mascarado do JSON
    RETURN (data_field::jsonb ->> 'masked');
  ELSE
    -- Se não for criptografado, retorna o valor original
    RETURN data_field;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, retorna o valor original
  RETURN data_field;
END;
$$ LANGUAGE plpgsql;

-- Tabela para armazenar configurações de criptografia
CREATE TABLE IF NOT EXISTS encryption_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- cpf, phone, email, card, cvv, generic
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(table_name, field_name)
);

-- Inserir configurações padrão de criptografia
INSERT INTO encryption_config (table_name, field_name, field_type) VALUES
  ('clientes', 'cpf', 'cpf'),
  ('clientes', 'telefone', 'phone'),
  ('clientes', 'endereco', 'generic'),
  ('cartoes', 'numero', 'card'),
  ('cartoes', 'cvv', 'cvv'),
  ('transacoes', 'dados_pagamento', 'generic')
ON CONFLICT (table_name, field_name) DO NOTHING;

-- Tabela para logs de acesso a dados sensíveis
CREATE TABLE IF NOT EXISTS sensitive_data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  field_name VARCHAR(100),
  action VARCHAR(50) NOT NULL, -- view, decrypt, export
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Índices para consultas eficientes
  INDEX idx_sensitive_access_user_id (user_id),
  INDEX idx_sensitive_access_table_record (table_name, record_id),
  INDEX idx_sensitive_access_created_at (created_at)
);

-- Habilitar RLS na tabela de logs de acesso
ALTER TABLE sensitive_data_access_logs ENABLE ROW LEVEL SECURITY;

-- Política para logs de acesso - usuários só podem ver seus próprios logs
CREATE POLICY "Users can view their own access logs" ON sensitive_data_access_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Política para inserção de logs - qualquer usuário autenticado pode inserir
CREATE POLICY "Authenticated users can insert access logs" ON sensitive_data_access_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tabela para controle de rotação de chaves
CREATE TABLE IF NOT EXISTS encryption_key_rotation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_version INTEGER NOT NULL,
  rotation_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(50) DEFAULT 'active', -- active, rotating, deprecated
  records_migrated INTEGER DEFAULT 0,
  total_records INTEGER DEFAULT 0,
  migration_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(key_version)
);

-- Inserir registro da chave inicial
INSERT INTO encryption_key_rotation (key_version, status) VALUES (1, 'active')
ON CONFLICT (key_version) DO NOTHING;

-- Função para registrar acesso a dados sensíveis
CREATE OR REPLACE FUNCTION log_sensitive_data_access(
  p_table_name VARCHAR(100),
  p_record_id VARCHAR(100),
  p_field_name VARCHAR(100) DEFAULT NULL,
  p_action VARCHAR(50) DEFAULT 'view',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO sensitive_data_access_logs (
    user_id,
    table_name,
    record_id,
    field_name,
    action,
    ip_address,
    user_agent,
    session_id
  ) VALUES (
    auth.uid(),
    p_table_name,
    p_record_id,
    p_field_name,
    p_action,
    p_ip_address,
    p_user_agent,
    p_session_id
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View para estatísticas de acesso a dados sensíveis
CREATE OR REPLACE VIEW sensitive_data_access_stats AS
SELECT 
  table_name,
  action,
  DATE_TRUNC('day', created_at) as access_date,
  COUNT(*) as access_count,
  COUNT(DISTINCT user_id) as unique_users
FROM sensitive_data_access_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY table_name, action, DATE_TRUNC('day', created_at)
ORDER BY access_date DESC, access_count DESC;

-- Função para limpar logs antigos de acesso
CREATE OR REPLACE FUNCTION cleanup_old_access_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sensitive_data_access_logs 
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log da limpeza
  INSERT INTO logs_auditoria (
    usuario_id,
    acao,
    tabela,
    registro_id,
    detalhes,
    severidade
  ) VALUES (
    auth.uid(),
    'CLEANUP',
    'sensitive_data_access_logs',
    'system',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'days_to_keep', days_to_keep,
      'cleanup_date', NOW()
    ),
    'LOW'
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar timestamp de atualização na configuração de criptografia
CREATE OR REPLACE FUNCTION update_encryption_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encryption_config_updated_at
  BEFORE UPDATE ON encryption_config
  FOR EACH ROW
  EXECUTE FUNCTION update_encryption_config_timestamp();

-- Comentários para documentação
COMMENT ON TABLE encryption_config IS 'Configuração de campos que devem ser criptografados por tabela';
COMMENT ON TABLE sensitive_data_access_logs IS 'Logs de acesso a dados sensíveis para auditoria';
COMMENT ON TABLE encryption_key_rotation IS 'Controle de rotação de chaves de criptografia';

COMMENT ON FUNCTION is_encrypted_data(TEXT) IS 'Verifica se um campo contém dados criptografados';
COMMENT ON FUNCTION get_masked_data(TEXT) IS 'Extrai dados mascarados de campos criptografados';
COMMENT ON FUNCTION log_sensitive_data_access IS 'Registra acesso a dados sensíveis para auditoria';
COMMENT ON FUNCTION cleanup_old_access_logs IS 'Remove logs de acesso antigos para manter performance';

-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_encryption_config_table_active 
  ON encryption_config(table_name) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_key_rotation_status 
  ON encryption_key_rotation(status, rotation_date);

-- Grants para funções
GRANT EXECUTE ON FUNCTION is_encrypted_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_masked_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_sensitive_data_access TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_access_logs TO service_role;