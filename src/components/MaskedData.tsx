import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Copy, Check } from 'lucide-react';
import { dataProtectionService } from '../lib/encryption/dataProtection';
import { MaskedData as MaskedDataType } from '../lib/encryption/types';

interface MaskedDataProps {
  data: string | MaskedDataType;
  type: MaskedDataType['type'];
  canReveal?: boolean;
  userId?: string;
  recordId?: string;
  className?: string;
  showCopyButton?: boolean;
  onReveal?: () => void;
}

/**
 * Componente para exibir dados sensíveis com mascaramento
 * Permite revelar dados se o usuário tiver permissão
 */
const MaskedData: React.FC<MaskedDataProps> = ({
  data,
  type,
  canReveal = false,
  userId,
  recordId,
  className = '',
  showCopyButton = false,
  onReveal
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determinar se os dados já estão mascarados ou precisam ser mascarados
  const maskedData = typeof data === 'string' 
    ? dataProtectionService.maskSensitiveData(data, type)
    : data;

  const displayValue = isRevealed && typeof data === 'string' ? data : maskedData.masked;

  const handleReveal = async () => {
    if (!canReveal) return;

    const newRevealState = !isRevealed;
    setIsRevealed(newRevealState);

    // Log de auditoria para acesso a dados sensíveis
    if (userId && recordId && newRevealState) {
      dataProtectionService.auditDataAccess(
        userId,
        type,
        recordId,
        'decrypt'
      );
    }

    // Callback personalizado
    if (onReveal) {
      onReveal();
    }
  };

  const handleCopy = async () => {
    if (!isRevealed || typeof data !== 'string') return;

    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      
      // Log de auditoria para cópia de dados
      if (userId && recordId) {
        dataProtectionService.auditDataAccess(
          userId,
          type,
          recordId,
          'export'
        );
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      {/* Ícone de proteção para dados mascarados */}
      {!isRevealed && (
        <Shield className="w-4 h-4 text-gray-400" title="Dados protegidos" />
      )}

      {/* Valor (mascarado ou revelado) */}
      <span 
        className={`font-mono ${isRevealed ? 'text-gray-900' : 'text-gray-600'}`}
        title={isRevealed ? 'Dados revelados' : 'Dados mascarados por segurança'}
      >
        {displayValue}
      </span>

      {/* Botão para revelar/ocultar */}
      {canReveal && (
        <button
          onClick={handleReveal}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title={isRevealed ? 'Ocultar dados' : 'Revelar dados'}
        >
          {isRevealed ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Botão para copiar (apenas quando revelado) */}
      {showCopyButton && isRevealed && (
        <button
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Copiar dados"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
};

export default MaskedData;

/**
 * Componente específico para CPF
 */
export const MaskedCPF: React.FC<Omit<MaskedDataProps, 'type'>> = (props) => (
  <MaskedData {...props} type="cpf" />
);

/**
 * Componente específico para telefone
 */
export const MaskedPhone: React.FC<Omit<MaskedDataProps, 'type'>> = (props) => (
  <MaskedData {...props} type="phone" />
);

/**
 * Componente específico para email
 */
export const MaskedEmail: React.FC<Omit<MaskedDataProps, 'type'>> = (props) => (
  <MaskedData {...props} type="email" />
);

/**
 * Componente específico para número de cartão
 */
export const MaskedCard: React.FC<Omit<MaskedDataProps, 'type'>> = (props) => (
  <MaskedData {...props} type="card" />
);

/**
 * Componente específico para CVV
 */
export const MaskedCVV: React.FC<Omit<MaskedDataProps, 'type'>> = (props) => (
  <MaskedData {...props} type="cvv" />
);