import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
  label,
  error,
  required = false,
  helpText,
  className = '',
  ...inputProps
}) => {
  const hasError = !!error;
  
  const inputClasses = `
    mt-1 block w-full border rounded-md px-3 py-2 
    focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${hasError 
      ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300' 
      : 'border-gray-300 bg-white'
    }
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <input
        {...inputProps}
        className={inputClasses}
        aria-invalid={hasError}
        aria-describedby={error ? `${inputProps.id}-error` : undefined}
      />
      
      {error && (
        <div 
          id={`${inputProps.id}-error`}
          className="flex items-center text-sm text-red-600"
        >
          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {helpText && !error && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
};

export default ValidatedInput;