import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Message, ProjectState, Project } from '@/types';
import { loadProjectState } from '@/lib/supabase';

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
  
  // Local storage helpers
  saveProjectToLocalStorage: (project: ProjectState) => void;
  loadProjectsFromLocalStorage: () => Project[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentProject: null,
  isLoading: false,
  error: null,
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  addMessage: (message) => set((state) => ({
    currentProject: state.currentProject 
      ? {
          ...state.currentProject,
          history: [...state.currentProject.history, message]
        }
      : null
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    currentProject: state.currentProject 
      ? {
          ...state.currentProject,
          history: state.currentProject.history.map(msg => 
            msg.id === id ? { ...msg, ...updates } : msg
          )
        }
      : null
  })),
  
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
      // Try to load from Supabase first
      const savedState = await loadProjectState(projectId);
      
      if (savedState) {
        // Convert saved state to our format
        const loadedProject: ProjectState = {
          project_id: projectId,
          history: savedState.history || [],
          assets: savedState.assets || {},
          phase: savedState.phase || 'initial',
          checklist: savedState.checklist || [],
          budget: savedState.budget
        };
        
        set({ currentProject: loadedProject, isLoading: false });
      } else {
        // Create new project if none exists
        const newProject: ProjectState = {
          project_id: projectId,
          history: [],
          assets: {},
          phase: 'initial',
          checklist: []
        };
        
        set({ currentProject: newProject, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      set({ error: 'Failed to load project', isLoading: false });
    }
  },
  
  saveProjectToLocalStorage: (project) => {
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
  },
  
  loadProjectsFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem('hollyProjects');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}));