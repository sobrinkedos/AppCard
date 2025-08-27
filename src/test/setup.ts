import '@testing-library/jest-dom';

// Mock do DOMPurify para ambiente de teste
global.DOMPurify = {
  sanitize: (input: string) => input.replace(/<[^>]*>/g, ''),
} as any;