import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder_key') {
  console.warn("⚠️ [경고] .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isMock = false;
