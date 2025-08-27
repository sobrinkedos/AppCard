/*
# [ADD MELHOR DIA COMPRA]

Esta migração adiciona o campo 'melhor_dia_compra' na tabela de configurações
para permitir que o lojista configure o melhor dia para compras dos clientes.

## Alterações:
1. Adiciona campo melhor_dia_compra (1-31) na tabela configuracoes
2. Define valor padrão como 5 (dia 5 de cada mês)
*/

-- Adicionar campo melhor_dia_compra na tabela configuracoes
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS melhor_dia_compra INTEGER DEFAULT 5 CHECK (melhor_dia_compra >= 1 AND melhor_dia_compra <= 31);

-- Comentário explicativo
COMMENT ON COLUMN public.configuracoes.melhor_dia_compra IS 'Melhor dia do mês para compras (1-31). Usado para calcular vencimentos de faturas parceladas';