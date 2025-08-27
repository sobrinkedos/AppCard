// Exportações principais do sistema de score de crédito

export * from './types';
export * from './creditScoreService';

// Re-exportar o serviço como default
export { creditScoreService as default } from './creditScoreService';