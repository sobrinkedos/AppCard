import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  RefreshCw, 
  Info,
  Clock,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { CreditScore, RiskClassification } from '../lib/creditScore/types';
import { creditScoreService } from '../lib/creditScore/creditScoreService';

interface CreditScoreCardProps {
  clienteId: string;
  showDetails?: boolean;
  onScoreUpdate?: (score: CreditScore) => void;
}

const CreditScoreCard: React.FC<CreditScoreCardProps> = ({
  clienteId,
  showDetails = false,
  onScoreUpdate
}) => {
  const [score, setScore] = useState<CreditScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScore();
  }, [clienteId]);

  const loadScore = async () => {
    try {
      setLoading(true);
      setError(null);
      const scoreData = await creditScoreService.getClienteScore(clienteId);
      setScore(scoreData);
      if (scoreData && onScoreUpdate) {
        onScoreUpdate(scoreData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setUpdating(true);
      setError(null);
      await creditScoreService.updateClienteScore(clienteId, 'RECALCULADO', 'Recálculo manual');
      await loadScore();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getScoreColor = (scoreValue: number): string => {
    if (scoreValue <= 200) return 'text-red-600';
    if (scoreValue <= 400) return 'text-orange-600';
    if (scoreValue <= 600) return 'text-yellow-600';
    if (scoreValue <= 800) return 'text-blue-600';
    return 'text-green-600';
  };

  const getScoreGradient = (scoreValue: number): string => {
    if (scoreValue <= 200) return 'from-red-500 to-red-600';
    if (scoreValue <= 400) return 'from-orange-500 to-orange-600';
    if (scoreValue <= 600) return 'from-yellow-500 to-yellow-600';
    if (scoreValue <= 800) return 'from-blue-500 to-blue-600';
    return 'from-green-500 to-green-600';
  };

  const getClassificationIcon = (classification: RiskClassification) => {
    if (classification === 'MUITO_BAIXO' || classification === 'BAIXO') {
      return <ShieldAlert className="w-5 h-5" />;
    }
    return <Shield className="w-5 h-5" />;
  };

  const isScoreExpired = (validoAte: string): boolean => {
    return new Date(validoAte) < new Date();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center text-red-600 mb-2">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span className="font-medium">Erro ao carregar score</span>
        </div>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={loadScore}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <Shield className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Score não calculado</h3>
          <p className="text-gray-600 text-sm mb-4">
            Este cliente ainda não possui um score de crédito calculado.
          </p>
          <button
            onClick={handleRecalculate}
            disabled={updating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center mx-auto"
          >
            {updating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4 mr-2" />
            )}
            {updating ? 'Calculando...' : 'Calcular Score'}
          </button>
        </div>
      </div>
    );
  }

  const expired = isScoreExpired(score.valido_ate);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${creditScoreService.getClassificationColor(score.classificacao_risco)}`}>
            {getClassificationIcon(score.classificacao_risco)}
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-gray-900">Score de Crédito</h3>
            <p className="text-sm text-gray-600">
              {creditScoreService.getClassificationText(score.classificacao_risco)}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRecalculate}
          disabled={updating}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          title="Recalcular score"
        >
          <RefreshCw className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Score Display */}
      <div className="mb-6">
        <div className="flex items-end mb-2">
          <span className={`text-4xl font-bold ${getScoreColor(score.score_valor)}`}>
            {score.score_valor}
          </span>
          <span className="text-gray-500 text-lg ml-1">/1000</span>
          
          {score.variacao_score !== null && score.variacao_score !== undefined && (
            <div className={`flex items-center ml-4 ${score.variacao_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {score.variacao_score >= 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              <span className="text-sm font-medium">
                {score.variacao_score > 0 ? '+' : ''}{score.variacao_score}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full bg-gradient-to-r ${getScoreGradient(score.score_valor)} transition-all duration-500`}
            style={{ width: `${(score.score_valor / 1000) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Alerts */}
      {(expired || score.bloqueado) && (
        <div className="mb-4 space-y-2">
          {expired && (
            <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Clock className="w-4 h-4 text-yellow-600 mr-2" />
              <span className="text-yellow-800 text-sm">
                Score expirado em {new Date(score.valido_ate).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
          
          {score.bloqueado && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
              <div className="text-red-800 text-sm">
                <div className="font-medium">Score bloqueado</div>
                {score.motivo_bloqueio && (
                  <div className="text-xs mt-1">{score.motivo_bloqueio}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className="space-y-4">
          {/* Fatores Positivos */}
          {score.fatores_positivos.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Fatores Positivos
              </h4>
              <ul className="space-y-1">
                {score.fatores_positivos.map((fator, index) => (
                  <li key={index} className="text-sm text-green-600 flex items-start">
                    <span className="w-1 h-1 bg-green-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {fator}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fatores Negativos */}
          {score.fatores_negativos.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                <TrendingDown className="w-4 h-4 mr-1" />
                Fatores Negativos
              </h4>
              <ul className="space-y-1">
                {score.fatores_negativos.map((fator, index) => (
                  <li key={index} className="text-sm text-red-600 flex items-start">
                    <span className="w-1 h-1 bg-red-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {fator}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Breakdown dos Componentes */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Info className="w-4 h-4 mr-1" />
              Composição do Score
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Histórico de Pagamentos</span>
                <span className="text-sm font-medium">{score.historico_pagamentos_score}/1000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Utilização do Limite</span>
                <span className="text-sm font-medium">{score.utilizacao_limite_score}/1000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tempo de Relacionamento</span>
                <span className="text-sm font-medium">{score.tempo_relacionamento_score}/1000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Diversidade de Transações</span>
                <span className="text-sm font-medium">{score.diversidade_transacoes_score}/1000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Comportamento Recente</span>
                <span className="text-sm font-medium">{score.comportamento_recente_score}/1000</span>
              </div>
            </div>
          </div>

          {/* Metadados */}
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
              <div>
                <span className="font-medium">Calculado em:</span>
                <br />
                {new Date(score.calculado_em).toLocaleString('pt-BR')}
              </div>
              <div>
                <span className="font-medium">Válido até:</span>
                <br />
                {new Date(score.valido_ate).toLocaleString('pt-BR')}
              </div>
              <div>
                <span className="font-medium">Algoritmo:</span>
                <br />
                {score.algoritmo_versao}
              </div>
              <div>
                <span className="font-medium">Tipo:</span>
                <br />
                {score.tipo_score}
              </div>
            </div>
            
            {score.observacoes && (
              <div className="mt-3">
                <span className="font-medium text-xs text-gray-500">Observações:</span>
                <p className="text-xs text-gray-600 mt-1">{score.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditScoreCard;