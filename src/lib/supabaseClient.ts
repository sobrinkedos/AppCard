import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
let supabaseError: string | null = null;

// Helper to check for placeholder or missing values
const isPlaceholderOrMissing = (value: string | undefined): boolean => {
  return !value || value === 'API_KEY_ADDED' || value.includes('YOUR_API_KEY');
};

// Basic URL validation
const isValidSupabaseUrl = (url: string | undefined): boolean => {
  if (isPlaceholderOrMissing(url)) return false;
  try {
    const newUrl = new URL(url!);
    // A valid Supabase URL is a HTTPS URL ending in .supabase.co or .supabase.in
    return newUrl.protocol === 'https:' && (newUrl.hostname.endsWith('.supabase.co') || newUrl.hostname.endsWith('.supabase.in'));
  } catch (e) {
    return false;
  }
};

if (!isValidSupabaseUrl(supabaseUrl) || isPlaceholderOrMissing(supabaseAnonKey)) {
  supabaseError = "As credenciais do Supabase não estão configuradas corretamente. Por favor, conecte seu projeto Supabase para continuar.";
  console.error(supabaseError, { url: supabaseUrl, key: supabaseAnonKey });
} else {
  try {
    supabase = createClient(supabaseUrl!, supabaseAnonKey!);
  } catch (error) {
    supabaseError = "Ocorreu um erro ao inicializar o cliente Supabase. Verifique se suas credenciais estão corretas.";
    console.error(supabaseError, error);
    supabase = null; // Ensure supabase is null on error
  }
}

export { supabase, supabaseError };
