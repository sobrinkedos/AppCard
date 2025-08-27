// Tipos base para corresponder aos enums do Supabase
export type UserRole = 'Admin' | 'Operador' | 'Visualizador';
export type CardStatus = 'Ativo' | 'Inativo' | 'Bloqueado';
export type TransactionStatus = 'Paga' | 'Pendente' | 'Atrasada' | 'Cancelada';
export type InvoiceStatus = 'Paga' | 'Aberta' | 'Atrasada' | 'Parcialmente Paga';
export type InviteStatus = 'Pendente' | 'Aceito' | 'Expirado';
export type NotificationType = 'Cobrança' | 'Cartão' | 'Cliente' | 'Sistema';
export type TicketStatus = 'Aberto' | 'Em Andamento' | 'Resolvido';

// Interfaces para as tabelas do Supabase
export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  endereco?: string;
  limite_credito: number;
  dia_vencimento?: number;
  status: CardStatus;
  data_cadastro: string;
}

export interface Cartao {
  id: string;
  cliente_id: string;
  numero_cartao: string;
  cvv: string;
  data_validade: string;
  limite: number;
  saldo_utilizado: number;
  status: CardStatus;
  design?: string;
  data_emissao: string;
  clientes?: { nome: string }; // Para joins
}

export interface Transacao {
  id: string;
  cartao_id: string;
  cliente_id: string;
  fatura_id?: string;
  descricao: string;
  valor: number;
  categoria?: string;
  parcela_atual: number;
  total_parcelas: number;
  status: TransactionStatus;
  data_transacao: string;
  clientes?: { nome: string }; // Para joins
  cartoes?: { numero_cartao: string }; // Para joins
}

export interface Fatura {
  id: string;
  cliente_id: string;
  competencia: string;
  data_vencimento: string;
  data_fechamento: string;
  valor_total: number;
  pagamento_minimo: number;
  status: InvoiceStatus;
  linha_digitavel?: string;
  data_criacao: string;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  cargo: UserRole;
  status: CardStatus;
  ultimo_acesso?: string;
  data_criacao: string;
}

export interface Convite {
  id: string;
  destinatario: string;
  tipo: 'Email' | 'WhatsApp';
  status: InviteStatus;
  limite_inicial?: number;
  data_envio: string;
  data_expiracao?: string;
}

export interface Notificacao {
  id: string;
  tipo: NotificationType;
  titulo: string;
  descricao?: string;
  lida: boolean;
  data_criacao: string;
}

export interface LogAuditoria {
  id: string;
  autor_id?: string;
  acao: string;
  alvo_id?: string;
  detalhes?: any;
  ip_address?: string;
  data_log: string;
  membros_equipe?: { nome: string }; // Para joins
}

export interface ChamadoSuporte {
  id: string;
  protocolo: string;
  autor_id: string;
  assunto: string;
  descricao?: string;
  status: TicketStatus;
  data_abertura: string;
  data_resolucao?: string;
  membros_equipe?: { nome: string }; // Para joins
}
