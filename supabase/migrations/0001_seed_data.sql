-- =============================================
-- SEED DATA SCRIPT
-- This script is safe to re-run. It will clear existing data before inserting new data.
-- =============================================

-- Clear existing data
TRUNCATE public.transacoes, public.faturas, public.cartoes, public.clientes, public.membros_equipe, public.convites, public.notificacoes, public.logs_auditoria, public.chamados_suporte RESTART IDENTITY CASCADE;

-- =============================================
-- INSTRUCTIONS:
-- 1. Create a user in your Supabase project's "Authentication" section.
-- 2. Copy the User ID (UUID) of that user.
-- 3. Replace the placeholder 'COLE_SEU_USER_ID_AQUI' below with the actual User ID.
-- =============================================

DO $$
DECLARE
    -- !!! IMPORTANT: REPLACE THIS PLACEHOLDER WITH YOUR ACTUAL USER ID FROM SUPABASE AUTH !!!
    v_lojista_id uuid := 'COLE_SEU_USER_ID_AQUI'; 
    
    v_cliente1_id uuid;
    v_cliente2_id uuid;
    v_cliente3_id uuid;
    v_cartao1_id uuid;
    v_cartao2_id uuid;
    v_cartao3_id uuid;
    v_fatura1_id uuid;
    v_fatura2_id uuid;
    v_fatura3_id uuid;
    v_membro1_id uuid;
BEGIN
    -- Insert Clientes
    INSERT INTO public.clientes (lojista_id, nome, cpf, email, limite_credito, status) VALUES
    (v_lojista_id, 'Ana Silva', '111.222.333-44', 'ana.silva@email.com', 1500.00, 'Ativo'),
    (v_lojista_id, 'Bruno Costa', '222.333.444-55', 'bruno.costa@email.com', 2500.00, 'Ativo'),
    (v_lojista_id, 'Carla Dias', '333.444.555-66', 'carla.dias@email.com', 800.00, 'Bloqueado')
    RETURNING id INTO v_cliente1_id, v_cliente2_id, v_cliente3_id;

    -- Insert Cartões
    INSERT INTO public.cartoes (lojista_id, cliente_id, numero_cartao, cvv, data_validade, limite, saldo_utilizado, status) VALUES
    (v_lojista_id, v_cliente1_id, '5555 4444 3333 2222', '123', '12/28', 1500.00, 750.50, 'Ativo'),
    (v_lojista_id, v_cliente2_id, '5555 4444 3333 1111', '456', '10/27', 2500.00, 1200.00, 'Ativo'),
    (v_lojista_id, v_cliente3_id, '5555 4444 3333 0000', '789', '08/26', 800.00, 800.00, 'Bloqueado')
    RETURNING id INTO v_cartao1_id, v_cartao2_id, v_cartao3_id;

    -- Insert Faturas
    INSERT INTO public.faturas (lojista_id, cliente_id, competencia, data_vencimento, data_fechamento, valor_total, pagamento_minimo, status) VALUES
    (v_lojista_id, v_cliente1_id, to_char(now() - interval '1 month', 'YYYY-MM'), (now() - interval '15 days')::date, (now() - interval '25 days')::date, 750.50, 112.58, 'Paga'),
    (v_lojista_id, v_cliente2_id, to_char(now(), 'YYYY-MM'), (now() + interval '10 days')::date, (now() - interval '5 days')::date, 1200.00, 180.00, 'Aberta'),
    (v_lojista_id, v_cliente3_id, to_char(now() - interval '2 months', 'YYYY-MM'), (now() - interval '45 days')::date, (now() - interval '55 days')::date, 800.00, 120.00, 'Atrasada')
    RETURNING id INTO v_fatura1_id, v_fatura2_id, v_fatura3_id;

    -- Insert Transações
    INSERT INTO public.transacoes (lojista_id, cartao_id, cliente_id, fatura_id, descricao, valor, status) VALUES
    (v_lojista_id, v_cartao1_id, v_cliente1_id, v_fatura1_id, 'Supermercado Pague Menos', 150.75, 'Paga'),
    (v_lojista_id, v_cartao1_id, v_cliente1_id, v_fatura1_id, 'Posto de Gasolina Shell', 100.00, 'Paga'),
    (v_lojista_id, v_cartao2_id, v_cliente2_id, v_fatura2_id, 'Loja de Roupas Renner', 350.00, 'Pendente'),
    (v_lojista_id, v_cartao2_id, v_cliente2_id, v_fatura2_id, 'Restaurante Outback', 250.00, 'Pendente'),
    (v_lojista_id, v_cartao3_id, v_cliente3_id, v_fatura3_id, 'Compra Online Amazon', 800.00, 'Atrasada');

    -- Insert Membros da Equipe
    INSERT INTO public.membros_equipe (lojista_id, nome, email, cargo, status) VALUES
    (v_lojista_id, 'João da Silva (Admin)', 'admin@lojadojoao.com', 'Admin', 'Ativo')
    RETURNING id INTO v_membro1_id;

    -- Insert Convites
    INSERT INTO public.convites (lojista_id, destinatario, tipo, status) VALUES
    (v_lojista_id, 'maria.futura.cliente@email.com', 'Email', 'Pendente'),
    (v_lojista_id, '(11) 98765-4321', 'WhatsApp', 'Aceito');

    -- Insert Notificações
    INSERT INTO public.notificacoes (lojista_id, tipo, titulo, descricao, lida) VALUES
    (v_lojista_id, 'Cobrança', 'Fatura de Carla Dias está atrasada', 'A fatura de R$ 800,00 venceu há 15 dias.', false),
    (v_lojista_id, 'Cliente', 'Novo cliente cadastrado', 'Bruno Costa completou o cadastro.', true);

    -- Insert Logs de Auditoria
    INSERT INTO public.logs_auditoria (lojista_id, autor_id, acao, detalhes) VALUES
    (v_lojista_id, v_membro1_id, 'Login de Usuário', '{"info": "Login bem-sucedido"}'),
    (v_lojista_id, v_membro1_id, 'Bloqueio de Cartão', '{"info": "Cartão de Carla Dias bloqueado por inadimplência"}');

    -- Insert Chamados de Suporte
    INSERT INTO public.chamados_suporte (lojista_id, protocolo, autor_id, assunto, status) VALUES
    (v_lojista_id, '202507-001', v_membro1_id, 'Dúvida sobre relatório de inadimplência', 'Resolvido');
END $$;
