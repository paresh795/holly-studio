import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function loadProjectState(projectId: string) {
  // Skip if using placeholder values
  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
    return null;
  }
  
  const { data, error } = await supabase
    .from('project_states')
    .select('state_data')
    .eq('project_id', projectId)
    .single();
  
  if (error) {
    console.error('Error loading project state:', error);
    return null;
  }
  
  return data?.state_data;
}