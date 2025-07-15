import { createClient } from '@supabase/supabase-js';

// Production-ready Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials missing! Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create robust Supabase client with production settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're not using auth, disable to avoid issues
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting for stability
    },
  },
  global: {
    headers: {
      'User-Agent': 'Holly-Studio/1.0',
    },
  },
});

// Database schema types matching your existing project_states table
export interface ProjectRecord {
  project_id: string;
  state_data: Record<string, unknown>; // Rich JSON state from n8n
  updated_at: string;
  created_at: string;
}

/**
 * Fetch latest project state from Supabase with robust error handling
 * This is called after each n8n operation to get fresh state
 */
export async function fetchProjectState(projectId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) {
    console.warn('⚠️ Supabase not configured, falling back to localStorage');
    return null;
  }

  try {
    console.log(`🔄 Fetching project state for ${projectId} from Supabase...`);
  
  const { data, error } = await supabase
      .from('project_states') // Using your existing table
      .select('state_data, updated_at')
    .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
    .single();
  
  if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - project doesn't exist yet
        console.log(`📝 Project ${projectId} not found in Supabase (new project)`);
        return null;
      }
      
      // Handle 406 Not Acceptable - usually RLS permission issues
      if (error.message?.includes('406') || error.message?.includes('Not Acceptable')) {
        console.error(`🚨 406 Error: Row Level Security permission issue!`);
        console.error(`❌ Fix: Run "ALTER TABLE project_states DISABLE ROW LEVEL SECURITY;" in Supabase SQL editor`);
        throw new Error('Supabase permission error (406): Row Level Security blocking access. Please disable RLS or add proper policies.');
      }
      
      throw error;
    }

    if (!data) {
      console.log(`📝 No state data found for project ${projectId}`);
      return null;
    }

    console.log(`✅ Successfully fetched state for project ${projectId}`);
    console.log(`🕒 State last updated: ${data.updated_at}`);
    
    return data.state_data;
    
  } catch (error) {
    console.error(`❌ Failed to fetch project state for ${projectId}:`, error);
    
    // For production: graceful degradation
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        console.warn('🌐 Network error accessing Supabase, using cached state');
      } else if (error.message.includes('timeout')) {
        console.warn('⏱️ Supabase timeout, using cached state');
      }
    }
    
    return null;
  }
}

/**
 * Save project state to Supabase (called by n8n, not frontend)
 * This is mainly for reference - n8n handles the actual saving
 */
export async function saveProjectState(projectId: string, stateData: Record<string, unknown>): Promise<boolean> {
  if (!supabase) {
    console.warn('⚠️ Supabase not configured, cannot save state');
    return false;
  }

  try {
    console.log(`💾 Saving project state for ${projectId} to Supabase...`);
    
    const { error } = await supabase
      .from('project_states')
      .upsert({
        project_id: projectId,
        state_data: stateData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id'
      });

    if (error) throw error;

    console.log(`✅ Successfully saved state for project ${projectId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to save project state for ${projectId}:`, error);
    return false;
  }
}

/**
 * Retry wrapper for Supabase operations with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break; // Final attempt failed
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

console.log('🚀 Supabase client initialized for production use');