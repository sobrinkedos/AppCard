-- Limpa os dados antigos para garantir um estado limpo
TRUNCATE TABLE public.clientes, public.cartoes, public.transacoes, public.faturas, public.membros_equipe, public.convites, public.notificacoes, public.logs_auditoria, public.chamados_suporte RESTART IDENTITY CASCADE;

-- Variável para o ID do lojista (substitua pelo seu User ID do Supabase Auth)
DO $$
DECLARE
    v_lojista_id UUID := 'COLE_SEU_USER_ID_AQUI'; -- <<<<<<< SUBSTITUA AQUI
    v_cliente1_id UUID := gen_random_uuid();
    v_cliente2_id UUID := gen_random_uuid();
    v_cliente3_id UUID := gen_random_uuid();
    v_cartao1_id UUID := gen_random_uuid();
    v_cartao2_id UUID := gen_random_uuid();
    v_cartao3_id UUID := gen_random_uuid();
    v_fatura1_id UUID := gen_random_uuid();
    v_fatura2_id UUID := gen_random_uuid();
    v_fatura3_id UUID := gen_random_uuid();
    v_membro1_id UUID := gen_random_uuid();
BEGIN

-- Clientes
INSERT INTO public.clientes (id, lojista_id, nome, cpf, email, telefone, endereco, limite_credito, status) VALUES
(v_cliente1_id, v_lojista_id, 'Ana Silva', '111.222.333-44', 'ana.silva@email.com', '(11) 98765-4321', 'Rua das Flores, 123', 1500.00, 'Ativo'),
(v_cliente2_id, v_lojista_id, 'Bruno Costa', '222.333.444-55', 'bruno.costa@email.com', '(21) 91234-5678', 'Avenida Principal, 456', 2500.00, 'Ativo'),
(v_cliente3_id, v_lojista_id, 'Carla Dias', '333.444.555-66', 'carla.dias@email.com', '(31) 95678-1234', 'Praça Central, 789', 800.00, 'Bloqueado');

-- Cartões
INSERT INTO public.cartoes (id, lojista_id, cliente_id, numero_cartao, cvv, data_validade, limite, saldo_utilizado, status, design) VALUES
(v_cartao1_id, v_lojista_id, v_cliente1_id, '5555 4444 3333 2222', '123', '2028-12-31', 1500.00, 750.50, 'Ativo', 'Clássico'),
(v_cartao2_id, v_lojista_id, v_cliente2_id, '5555 4444 3333 1111', '456', '2027-11-30', 2500.00, 1200.00, 'Ativo', 'Premium'),
(v_cartao3_id, v_lojista_id, v_cliente3_id, '5555 4444 3333 0000', '789', '2026-10-31', 800.00, 800.00, 'Bloqueado', 'Personalizado');

-- Faturas
INSERT INTO public.faturas (id, lojista_id, cliente_id, competencia, data_vencimento, data_fechamento, valor_total, pagamento_minimo, status) VALUES
(v_fatura1_id, v_lojista_id, v_cliente1_id, 'Junho/2025', (now() + interval '10 days'), now(), 750.50, 112.58, 'Aberta'),
(v_fatura2_id, v_lojista_id, v_cliente2_id, 'Junho/2025', (now() + interval '12 days'), now(), 1200.00, 180.00, 'Aberta'),
(v_fatura3_id, v_lojista_id, v_cliente3_id, 'Maio/2025', (now() - interval '20 days'), (now() - interval '30 days'), 800.00, 120.00, 'Atrasada'),
(gen_random_uuid(), v_lojista_id, v_cliente1_id, 'Maio/2025', (now() - interval '20 days'), (now() - interval '30 days'), 540.20, 81.03, 'Paga');

-- Transações
INSERT INTO public.transacoes (id, lojista_id, cartao_id, cliente_id, fatura_id, descricao, valor, categoria, parcela_atual, total_parcelas, status) VALUES
(gen_random_uuid(), v_lojista_id, v_cartao1_id, v_cliente1_id, v_fatura1_id, 'Supermercado Pão de Açúcar', 150.75, 'Alimentação', 1, 1, 'Pendente'),
(gen_random_uuid(), v_lojista_id, v_cartao1_id, v_cliente1_id, v_fatura1_id, 'Restaurante Sabor Divino', 89.90, 'Restaurante', 1, 1, 'Pendente'),
(gen_random_uuid(), v_lojista_id, v_cartao2_id, v_cliente2_id, v_fatura2_id, 'Loja de Roupas Renner', 350.00, 'Vestuário', 1, 2, 'Pendente'),
(gen_random_uuid(), v_lojista_id, v_cartao2_id, v_cliente2_id, v_fatura2_id, 'Posto Shell', 120.00, 'Transporte', 1, 1, 'Pendente'),
(gen_random_uuid(), v_lojista_id, v_cartao3_id, v_cliente3_id, v_fatura3_id, 'Farmácia Drogasil', 75.20, 'Saúde', 1, 1, 'Pendente');

-- Membros da Equipe
INSERT INTO public.membros_equipe (id, lojista_id, nome, email, cargo, status, ultimo_acesso) VALUES
(v_membro1_id, v_lojista_id, 'João da Silva (Admin)', 'admin@lojadojoao.com', 'Admin', 'Ativo', now()),
(gen_random_uuid(), v_lojista_id, 'Maria Oliveira (Operador)', 'maria.op@lojadojoao.com', 'Operador', 'Ativo', now() - interval '2 days');

-- Convites
INSERT INTO public.convites (id, lojista_id, destinatario, tipo, status, limite_inicial) VALUES
(gen_random_uuid(), v_lojista_id, 'novo.cliente@email.com', 'Email', 'Pendente', 1000.00),
(gen_random_uuid(), v_lojista_id, '(11) 91111-2222', 'WhatsApp', 'Aceito', 500.00);

-- Notificações
INSERT INTO public.notificacoes (id, lojista_id, tipo, titulo, descricao, lida) VALUES
(gen_random_uuid(), v_lojista_id, 'Cobrança', 'Fatura Atrasada', 'A fatura de Carla Dias venceu há 20 dias.', false),
(gen_random_uuid(), v_lojista_id, 'Cartão', 'Cartão Bloqueado', 'O cartão de Carla Dias foi bloqueado por inadimplência.', false),
(gen_random_uuid(), v_lojista_id, 'Cliente', 'Novo Cliente Cadastrado', 'O cliente Bruno Costa aceitou o convite e se cadastrou.', true);

-- Logs de Auditoria
INSERT INTO public.logs_auditoria (id, lojista_id, autor_id, acao, alvo_id, detalhes, ip_address) VALUES
(gen_random_uuid(), v_lojista_id, v_membro1_id, 'Bloqueio de Cartão', v_cartao3_id, '{"motivo": "Inadimplência"}', '192.168.1.1'),
(gen_random_uuid(), v_lojista_id, v_membro1_id, 'Alteração de Limite', v_cliente1_id, '{"de": 1000, "para": 1500}', '192.168.1.1');

-- Chamados de Suporte
INSERT INTO public.chamados_suporte (id, lojista_id, protocolo, autor_id, assunto, descricao, status) VALUES
(gen_random_uuid(), v_lojista_id, '202507-001', v_membro1_id, 'Dúvida sobre exportação', 'Não consigo exportar o relatório de vendas em PDF.', 'Resolvido'),
(gen_random_uuid(), v_lojista_id, '202507-002', v_membro1_id, 'Problema com login', 'Um membro da equipe não consegue acessar o painel.', 'Aberto');

END $$;
