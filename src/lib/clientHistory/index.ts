// =====================================================
// Índice do Sistema de Histórico de Clientes
// =====================================================

// Tipos
export type {
  HistoricoCliente,
  ConfiguracaoAuditoriaClientes,
  ComparacaoVersoes,
  EstatisticasHistorico,
  FiltrosHistorico,
  HistoricoClienteDetalhado,
  ResumoAlteracao,
  ConfiguracaoVisualizacao,
  HistoricoClienteProps,
  ComparadorVersoesProps,
  FiltroHistoricoProps,
  TimelineHistoricoProps,
  UseHistoricoClienteReturn,
  UseComparacaoVersoesReturn,
  UseEstatisticasHistoricoReturn,
  FormatadorCampo,
  ConfiguracaoMascara
} from './types';

// Constantes
export {
  TIPOS_OPERACAO,
  CAMPOS_CLIENTE,
  CAMPOS_SENSIVEIS,
  CORES_OPERACAO,
  ICONES_OPERACAO
} from './types';

// Serviços
export { clientHistoryService } from './clientHistoryService';

// Hooks
export {
  useClientHistory,
  useVersionComparison,
  useHistoryStatistics,
  useAuditConfiguration,
  useHistorySearch,
  useHistoryExport
} from '../hooks/useClientHistory';

// Componentes
export { default as ClientHistoryViewer } from '../components/ClientHistoryViewer';