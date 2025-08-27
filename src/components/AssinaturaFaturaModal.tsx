import React, { useState } from 'react';
import { X, FileText, CheckCircle } from 'lucide-react';

interface AssinaturaFaturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  fatura: {
    id: string;
    valor_total: number;
    data_vencimento: string;
    cliente_nome: string;
  };
  onAssinaturaConcluida: () => void;
}

const AssinaturaFaturaModal: React.FC<AssinaturaFaturaModalProps> = ({
  isOpen,
  onClose,
  fatura,
  onAssinaturaConcluida
}) => {
  const [assinando, setAssinando] = useState(false);
  const [assinaturaConcluida, setAssinaturaConcluida] = useState(false);
  const [assinatura, setAssinatura] = useState('');

  const handleAssinatura = async () => {
    if (!assinatura.trim()) {
      alert('Por favor, digite sua assinatura digital.');
      return;
    }

    setAssinando(true);
    
    // Simular processo de assinatura digital
    setTimeout(() => {
      setAssinaturaConcluida(true);
      setAssinando(false);
      
      // Aguardar um momento para mostrar o sucesso
      setTimeout(() => {
        onAssinaturaConcluida();
        onClose();
        setAssinaturaConcluida(false);
        setAssinatura('');
      }, 2000);
    }, 1500);
  };

  const handleClose = () => {
    if (!assinando) {
      onClose();
      setAssinaturaConcluida(false);
      setAssinatura('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <FileText className="mr-2" size={24} />
            Assinatura Digital da Fatura
          </h2>
          {!assinando && (
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {assinaturaConcluida ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={64} />
            <h3 className="text-lg font-semibold text-green-600 mb-2">
              Fatura Assinada com Sucesso!
            </h3>
            <p className="text-gray-600">
              A fatura foi assinada digitalmente e está pronta para processamento.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Detalhes da Fatura:</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cliente:</span>
                  <span className="font-medium">{fatura.cliente_nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="font-medium text-green-600">
                    R$ {fatura.valor_total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vencimento:</span>
                  <span className="font-medium">
                    {new Date(fatura.data_vencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assinatura Digital:
              </label>
              <input
                type="text"
                value={assinatura}
                onChange={(e) => setAssinatura(e.target.value)}
                placeholder="Digite seu nome completo para assinar"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={assinando}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ao digitar seu nome, você está concordando com os termos da fatura.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                disabled={assinando}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssinatura}
                disabled={assinando || !assinatura.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {assinando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Assinando...
                  </>
                ) : (
                  'Assinar Fatura'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssinaturaFaturaModal;