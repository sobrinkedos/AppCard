import React, { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { Cliente } from '../types';
import { clienteSchema } from '../lib/validation/schemas';
import { useFormValidation } from '../hooks/useValidation';
import ValidatedInput from './ValidatedInput';
import { formatCPF, formatPhone } from '../lib/validation/sanitizers';

interface ClienteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  editingClient?: Cliente | null;
  loading?: boolean;
}

const ClienteFormModal: React.FC<ClienteFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingClient,
  loading = false
}) => {
  const initialData = editingClient ? {
    nome: editingClient.nome,
    cpf: editingClient.cpf,
    email: editingClient.email,
    telefone: editingClient.telefone || '',
    endereco: editingClient.endereco || '',
    limite_credito: editingClient.limite_credito,
    dia_vencimento: editingClient.dia_vencimento || 5,
    status: editingClient.status
  } : {
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    endereco: '',
    limite_credito: 0,
    dia_vencimento: 5,
    status: 'Ativo' as const
  };

  const {
    formData,
    updateField,
    resetForm,
    submitForm,
    errors,
    isValid,
    isValidating,
    clearErrors
  } = useFormValidation(clienteSchema, initialData, {
    sanitize: true,
    validateOnChange: true
  });

  useEffect(() => {
    if (isOpen) {
      clearErrors();
      if (editingClient) {
        // Atualiza os dados do formulário quando abre para edição
        Object.keys(initialData).forEach(key => {
          updateField(key as keyof typeof initialData, initialData[key as keyof typeof initialData]);
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await submitForm();
    if (result.isValid && result.data) {
      try {
        await onSubmit(result.data);
        onClose();
        resetForm();
      } catch (error) {
        console.error('Erro ao salvar cliente:', error);
      }
    }
  };

  const handleCPFChange = (value: string) => {
    // Remove formatação e aplica máscara
    const cleanValue = value.replace(/\D/g, '');
    updateField('cpf', cleanValue);
  };

  const handlePhoneChange = (value: string) => {
    // Remove formatação
    const cleanValue = value.replace(/\D/g, '');
    updateField('telefone', cleanValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <ValidatedInput
                id="nome"
                label="Nome Completo"
                value={formData.nome || ''}
                onChange={(e) => updateField('nome', e.target.value)}
                error={errors.nome}
                required
                placeholder="Digite o nome completo"
              />
            </div>

            <ValidatedInput
              id="cpf"
              label="CPF"
              value={formData.cpf ? formatCPF(formData.cpf) : ''}
              onChange={(e) => handleCPFChange(e.target.value)}
              error={errors.cpf}
              required
              placeholder="000.000.000-00"
              maxLength={14}
            />

            <ValidatedInput
              id="email"
              type="email"
              label="Email"
              value={formData.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              error={errors.email}
              required
              placeholder="email@exemplo.com"
            />

            <ValidatedInput
              id="telefone"
              label="Telefone"
              value={formData.telefone ? formatPhone(formData.telefone) : ''}
              onChange={(e) => handlePhoneChange(e.target.value)}
              error={errors.telefone}
              placeholder="(11) 99999-8888"
              helpText="Opcional - incluir DDD"
            />

            <ValidatedInput
              id="limite_credito"
              type="number"
              label="Limite de Crédito"
              value={formData.limite_credito || ''}
              onChange={(e) => updateField('limite_credito', parseFloat(e.target.value) || 0)}
              error={errors.limite_credito}
              min="0"
              step="0.01"
              placeholder="0,00"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Dia de Vencimento da Fatura
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={formData.dia_vencimento || 5}
                onChange={(e) => updateField('dia_vencimento', parseInt(e.target.value))}
                className={`mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.dia_vencimento ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              {errors.dia_vencimento && (
                <p className="text-sm text-red-600 mt-1">{errors.dia_vencimento}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Dia do mês em que as faturas deste cliente vencem
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={formData.status || 'Ativo'}
                onChange={(e) => updateField('status', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.status ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
              {errors.status && (
                <p className="text-sm text-red-600 mt-1">{errors.status}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <ValidatedInput
                id="endereco"
                label="Endereço"
                value={formData.endereco || ''}
                onChange={(e) => updateField('endereco', e.target.value)}
                error={errors.endereco}
                placeholder="Endereço completo (opcional)"
                helpText="Campo opcional"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || isValidating}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || isValidating || !isValid}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
            >
              {(loading || isValidating) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClienteFormModal;