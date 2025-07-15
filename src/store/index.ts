import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Message, ProjectState, Project } from '@/types';
import { fetchProjectState, withRetry } from '@/lib/supabase';

interface ChatStore {
  // Current project state
  currentProject: ProjectState | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentProject: (project: ProjectState | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Project management
  createNewProject: () => string;
  loadProject: (projectId: string) => Promise<void>;
  
  // Supabase state management
  refreshProjectStateFromSupabase: (projectId: string) => Promise<void>;
  
  // Local storage helpers (fallback)
  saveProjectToLocalStorage: (project: ProjectState) => void;
  loadProjectsFromLocalStorage: () => Project[];
  loadProjectFromLocalStorage: (projectId: string) => ProjectState | null;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentProject: null,
  isLoading: false,
  error: null,
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  addMessage: (message) => set((state) => {
    if (!state.currentProject) {
      console.log('⚠️ Store: Cannot add message - no current project');
      return state;
    }
    
    console.log('🔍 Store: Adding message to project', state.currentProject.project_id, ':', message);
    
    const updatedProject = {
      ...state.currentProject,
      history: [...state.currentProject.history, message]
    };
    
    console.log('✅ Store: Updated project history length:', updatedProject.history.length);
    
    // Auto-save to localStorage
    get().saveProjectToLocalStorage(updatedProject);
    console.log('✅ Store: Saved project to localStorage');
    
    return { currentProject: updatedProject };
  }),
  
  updateMessage: (id, updates) => set((state) => {
    if (!state.currentProject) return state;
    
    const updatedProject = {
      ...state.currentProject,
      history: state.currentProject.history.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    };
    
    // Auto-save to localStorage
    get().saveProjectToLocalStorage(updatedProject);
    
    return { currentProject: updatedProject };
  }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  createNewProject: () => {
    const projectId = uuidv4();
    const newProject: ProjectState = {
      project_id: projectId,
      history: [],
      assets: {},
      phase: 'initial',
      checklist: []
    };
    
    set({ currentProject: newProject });
    
    // Save to localStorage
    localStorage.setItem('hollyProjectId', projectId);
    get().saveProjectToLocalStorage(newProject);
    
    return projectId;
  },
  
  loadProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // FIRST: Load chat history from localStorage (this is critical!)
      const localState = get().loadProjectFromLocalStorage(projectId);
      
      if (localState) {
        console.log(`📚 Loading chat history from localStorage: ${localState.history.length} messages`);
        // Set the project with chat history FIRST
        set({ currentProject: localState, isLoading: false });
        
        // THEN: Refresh rich state from Supabase while preserving history
        await get().refreshProjectStateFromSupabase(projectId);
      } else {
        // No local state - try Supabase first, then create new
        await get().refreshProjectStateFromSupabase(projectId);
        
        const currentState = get().currentProject;
        if (!currentState) {
          // Create new project if none exists
          const newProject: ProjectState = {
            project_id: projectId,
            history: [],
            assets: {},
            phase: 'initial',
            checklist: []
          };
          
          set({ currentProject: newProject, isLoading: false });
          get().saveProjectToLocalStorage(newProject);
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      set({ error: 'Failed to load project', isLoading: false });
    }
  },

  refreshProjectStateFromSupabase: async (projectId: string) => {
    console.log(`🔄 Refreshing state for project ${projectId} from Supabase...`);
    
    try {
      // Use retry wrapper for robust fetching
      const supabaseState = await withRetry(
        () => fetchProjectState(projectId),
        3, // 3 retries
        1000 // 1 second base delay
      );
      
      if (supabaseState) {
        console.log('✅ Got fresh state from Supabase:', Object.keys(supabaseState));
        
        // CRITICAL: Get current project and preserve ALL existing data
        const currentProject = get().currentProject;
        const existingHistory = currentProject?.history || [];
        const rawSupabaseHistory = Array.isArray(supabaseState.history) ? supabaseState.history : [];
        
        // 🔧 NORMALIZE BACKEND MESSAGE FORMAT TO FRONTEND FORMAT
        const normalizedSupabaseHistory = rawSupabaseHistory.map((msg: any, index: number) => {
          // Generate unique ID for React keys - use more distinctive IDs to prevent collisions
          const messageId = msg.id || `supabase_${projectId}_${index}_${msg.role}_${Date.now()}`;
          
          // Handle timestamp conversion properly
          let timestamp: Date;
          if (msg.timestamp) {
            // Handle various timestamp formats
            if (typeof msg.timestamp === 'string') {
              // Check if it's already a valid ISO string
              const parsedTime = new Date(msg.timestamp);
              if (!isNaN(parsedTime.getTime()) && parsedTime.getFullYear() > 1970) {
                timestamp = parsedTime;
              } else {
                // Invalid timestamp, use current time with small offset to maintain order
                timestamp = new Date(Date.now() + index * 1000); // Add index seconds to maintain order
                console.warn('Invalid timestamp detected, using current time with offset:', msg.timestamp);
              }
            } else if (msg.timestamp instanceof Date) {
              timestamp = msg.timestamp;
            } else {
              // Fallback to current time for unexpected formats
              timestamp = new Date(Date.now() + index * 1000);
            }
          } else {
            timestamp = new Date(Date.now() + index * 1000);
          }
          
          return {
            id: messageId,
            content: msg.message || msg.content || '', // Handle both backend and frontend formats
            role: msg.role || 'assistant',
            timestamp: timestamp,
            mediaUrls: msg.mediaUrls || [],
            error: msg.error || undefined
          };
        });
        
        // 🔧 ENHANCED LOGIC: Protect recent user messages from being lost
        const useSupabaseHistory = normalizedSupabaseHistory.length > existingHistory.length;
        
        // SAFETY CHECK: If local history has recent messages (within last 30 seconds), preserve them
        const now = Date.now();
        const recentUserMessages = existingHistory.filter(msg => 
          msg.role === 'user' && 
          new Date(msg.timestamp).getTime() > (now - 30000) // Within last 30 seconds
        );
        
        let finalHistory: Message[];
        if (recentUserMessages.length > 0 && !useSupabaseHistory) {
          console.log(`🛡️ Protecting ${recentUserMessages.length} recent user messages from being lost`);
          finalHistory = existingHistory;
        } else if (useSupabaseHistory) {
          // If using Supabase history, make sure to merge any recent user messages
          const mergedHistory = [...normalizedSupabaseHistory];
                     for (const recentMsg of recentUserMessages) {
             const exists = mergedHistory.some(msg => msg.id === recentMsg.id);
             if (!exists) {
               console.log(`🔄 Merging recent user message into Supabase history:`, recentMsg.content);
               mergedHistory.push({
                 id: recentMsg.id,
                 content: recentMsg.content,
                 role: recentMsg.role,
                 timestamp: recentMsg.timestamp,
                 mediaUrls: recentMsg.mediaUrls || [],
                 error: recentMsg.error || undefined
               });
             }
           }
          // Sort by timestamp to maintain order
          mergedHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          finalHistory = mergedHistory;
        } else {
          finalHistory = existingHistory;
        }
        
        console.log(`📚 History decision: Supabase(${rawSupabaseHistory.length}) vs Local(${existingHistory.length}) -> Using ${useSupabaseHistory ? 'Supabase+Recent' : 'Local'} history`);
        console.log(`🔧 Normalized ${rawSupabaseHistory.length} backend messages to frontend format`);
        console.log(`🛡️ Final history length: ${finalHistory.length} (protected ${recentUserMessages.length} recent messages)`);
        
        // Merge Supabase state with existing frontend data - Use backend history when available
        const updatedProject: ProjectState = {
          ...currentProject, // Start with current project to preserve everything
          project_id: projectId,
          history: finalHistory, // Use the most complete history
          assets: supabaseState.assets || currentProject?.assets || {},
          phase: (supabaseState.phase as string) || currentProject?.phase || 'initial',
          checklist: supabaseState.checklist || currentProject?.checklist || {},
          budget: (supabaseState.budget as { spent: number; total: number }) || currentProject?.budget || { spent: 0, total: 15 }
        };
        
        console.log('🔄 Merged project state:', {
          assets: Object.keys(updatedProject.assets),
          phase: updatedProject.phase,
          checklistKeys: Array.isArray(updatedProject.checklist) ? 
            updatedProject.checklist.map(item => item.id) : 
            Object.keys(updatedProject.checklist),
          historyLength: updatedProject.history.length,
          historySource: useSupabaseHistory ? 'Supabase (backend-managed)' : 'Local (frontend-managed)',
          finalMessages: `✅ ${updatedProject.history.length} messages total`
        });
        
        set({ currentProject: updatedProject, isLoading: false });
        
        // Also save to localStorage as backup (including the preserved history)
        get().saveProjectToLocalStorage(updatedProject);
        
      } else {
        console.log('📝 No state found in Supabase for project, keeping existing data');
        set({ isLoading: false });
      }
      
    } catch (error) {
      console.error('❌ Failed to refresh state from Supabase:', error);
      
      // Handle specific 406/RLS error with helpful message
      if (error instanceof Error && error.message.includes('permission error (406)')) {
        console.error('🚨 SUPABASE RLS ISSUE: Please disable Row Level Security!');
        console.error('📝 Run this SQL: ALTER TABLE project_states DISABLE ROW LEVEL SECURITY;');
        
        set({ 
          error: 'Database permission issue. Please check console for fix instructions.',
          isLoading: false 
        });
      } else {
        // Don't set error state for other issues - gracefully degrade to existing data
        set({ isLoading: false });
      }
    }
  },
  
  saveProjectToLocalStorage: (project) => {
    // Save project metadata
    const projects = get().loadProjectsFromLocalStorage();
    const projectName = project.assets.core_idea?.slice(0, 30) || 'Untitled';
    
    const projectMeta: Project = {
      id: project.project_id,
      name: projectName,
      lastSeen: new Date()
    };
    
    const updatedProjects = projects.filter(p => p.id !== project.project_id);
    updatedProjects.unshift(projectMeta);
    
    // Keep only last 10 projects
    const limitedProjects = updatedProjects.slice(0, 10);
    
    localStorage.setItem('hollyProjects', JSON.stringify(limitedProjects));
    
    // Save full project state
    localStorage.setItem(`hollyProject_${project.project_id}`, JSON.stringify(project));
  },
  
  loadProjectsFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem('hollyProjects');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  
  loadProjectFromLocalStorage: (projectId: string) => {
    try {
      const stored = localStorage.getItem(`hollyProject_${projectId}`);
      if (stored) {
        const projectData = JSON.parse(stored);
        // Convert timestamps back to Date objects
        return {
          ...projectData,
          history: projectData.history?.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })) || []
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}));