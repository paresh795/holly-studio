'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AIInputWithLoading } from '@/components/ui/ai-input-with-loading';
import { useChatStore } from '@/store';
import { toast } from 'sonner';
import { sendWebhookMessage, getCurrentOperationStatus } from '@/lib/webhook';

export default function ChatComposer() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [longTaskBanner, setLongTaskBanner] = useState(false);
  const [operationProgress, setOperationProgress] = useState<{
    isActive: boolean;
    operationId: string | null;
    elapsedMinutes: number;
    expectedDuration: number;
    phase: string;
  }>({
    isActive: false,
    operationId: null,
    elapsedMinutes: 0,
    expectedDuration: 0,
    phase: ''
  });
  
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    currentProject, 
    addMessage, 
    setCurrentProject,
    refreshProjectStateFromSupabase 
  } = useChatStore();

  const getOperationPhase = useCallback((operationId: string | null): string => {
    if (!operationId) return '';
    if (operationId.includes('video')) {
      return 'Video Generation';
    }
    if (operationId.includes('image')) return 'Image Generation';
    if (operationId.includes('narration')) return 'Narration Generation';
    return 'Processing';
  }, []);

  const placeholders = [
    "Generate a 30-second commercial script for a new brand of coffee",
    "Create a visual storyboard for a short film about a time-traveling cat",
    "Design a modern, minimalist logo for a company called 'Innovatech'",
    "What if we made the perfume ad... but set it in a cyberpunk city?",
    "Generate image: a synthwave sunset over a retro-futuristic city",
    "Write a catchy jingle for a new type of sparkling water",
    "Describe a character: a grizzled space detective with a robot sidekick",
  ];

  const handleChange = (value: string) => {
    setMessage(value);
  };

  // Monitor operation progress
  useEffect(() => {
    const startProgressMonitoring = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      progressIntervalRef.current = setInterval(() => {
        const status = getCurrentOperationStatus();
        
        if (status.isActive && status.startTime) {
          const elapsed = Date.now() - status.startTime;
          const elapsedMinutes = Math.floor(elapsed / 60000);
          
          setOperationProgress({
            isActive: true,
            operationId: status.operationId,
            elapsedMinutes,
            expectedDuration: status.expectedDuration,
            phase: getOperationPhase(status.operationId)
          });
          
          // Auto refresh from Supabase during long operations for real-time progress
          if (elapsedMinutes > 0 && elapsedMinutes % 1 === 0 && currentProject?.project_id) { // Check every minute
            refreshProjectStateFromSupabase(currentProject.project_id)
              .then(() => {
                console.log('✅ Successfully refreshed state from Supabase');
                const updatedProject = useChatStore.getState().currentProject;
                console.log('📚 After refresh:', updatedProject?.history?.length, 'messages preserved');
                
                // Check if operation actually completed while we were monitoring
                const status = getCurrentOperationStatus();
                if (status.isActive && updatedProject?.assets) {
                  const hasNewVideos = updatedProject.assets.video_clips && updatedProject.assets.video_clips.length > 0;
                  const hasNewAssets = Object.keys(updatedProject.assets).length > 5; // Basic asset count check
                  
                  if (hasNewVideos || hasNewAssets) {
                    console.log('🎬 New assets detected during monitoring - operation may be complete');
                    toast.success('🎬 New content detected! Your operation may be complete. Check the sidebar for updates.');
                  }
                }
              })
              .catch((error) => {
                console.error('❌ Failed to refresh from Supabase:', error);
              });
          }
        } else {
          setOperationProgress({
            isActive: false,
            operationId: null,
            elapsedMinutes: 0,
            expectedDuration: 0,
            phase: ''
          });
        }
      }, 5000); // Check every 5 seconds
    };

    if (isLoading) {
      startProgressMonitoring();
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isLoading, currentProject?.project_id, refreshProjectStateFromSupabase, getOperationPhase]);
  
  const handleSubmit = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    if (!currentProject?.project_id) {
      toast.error('No active project. Please create a new project first.');
      return;
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      content: messageText,
      role: 'user' as const,
      timestamp: new Date(),
    };
    
    // Add user message immediately
    console.log('🔍 ChatComposer: Adding user message to store:', userMessage);
    addMessage(userMessage);
    setMessage('');
    setIsLoading(true);
    setLongTaskBanner(false);

    // Clear any existing banner timeout
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }

    // Show long task banner after 10 seconds for any operation that takes longer
    bannerTimeoutRef.current = setTimeout(() => {
      setLongTaskBanner(true);
    }, 10000);

    try {
      const response = await sendWebhookMessage({
        message: messageText,
        project_id: currentProject.project_id,
        chat_id: currentProject.project_id,
        previous_messages: (currentProject.history || []).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : msg.timestamp.toISOString()
        }))
      });

      // Add assistant's response to chat history if present
      if (response.response_to_user) {
        const assistantMessage = {
          id: `msg_${Date.now()}_assistant`,
          content: response.response_to_user,
          role: 'assistant' as const,
          timestamp: new Date(),
        };
        
        // Check if this message already exists to prevent duplicates
        const freshProject = useChatStore.getState().currentProject;
        const existingMessage = freshProject?.history?.find(msg => 
          msg.role === 'assistant' && 
          msg.content === response.response_to_user &&
          Date.now() - new Date(msg.timestamp).getTime() < 60000 // Within 1 minute
        );
        
        if (!existingMessage) {
          console.log('🔍 ChatComposer: Adding assistant response to store:', assistantMessage);
          addMessage(assistantMessage);
        } else {
          console.log('⚠️ ChatComposer: Duplicate assistant message detected - skipping add');
        }
      }
      
      // Update project state if provided (assets, phase, checklist, etc.)
      if (response.updatedStateJson) {
        console.log('🔄 ChatComposer: Updating project state with response:', {
          assets_keys: Object.keys(response.updatedStateJson.assets || {}),
          final_images: (response.updatedStateJson.assets as any)?.final_images?.length || 0,
          phase: response.updatedStateJson.phase
        });
        
        // CRITICAL FIX: Get CURRENT project state from store, not stale component state
        const freshCurrentProject = useChatStore.getState().currentProject;
        const currentHistory = freshCurrentProject?.history || [];
        console.log('🔍 ChatComposer: Preserving FRESH current history length:', currentHistory.length);
        
        const updatedProject = {
          ...freshCurrentProject,
          ...response.updatedStateJson,
          // ALWAYS preserve current history - NEVER overwrite from response
          history: currentHistory,
          project_id: freshCurrentProject?.project_id || currentProject.project_id // Also preserve project ID
        };
        
        console.log('✅ ChatComposer: State updated, history preserved:', updatedProject.history.length);
        setCurrentProject(updatedProject);
        
        console.log('✅ ChatComposer: Project state updated, triggering Supabase refresh...');
      }

      // Auto-refresh from Supabase after each operation
      if (currentProject.project_id) {
        try {
          await refreshProjectStateFromSupabase(currentProject.project_id);
          console.log('✅ Successfully refreshed state from Supabase');
          const finalProject = useChatStore.getState().currentProject;
          console.log('📚 After refresh:', finalProject?.history?.length, 'messages preserved');
        } catch (error) {
          console.error('❌ Failed to refresh from Supabase:', error);
        }
      }

      // Clear the banner timeout since we got a response
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      setLongTaskBanner(false);

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get a random placeholder
  const randomPlaceholder = placeholders[Math.floor(Math.random() * placeholders.length)];

  return (
    <div className="border-t border-border bg-background">
      {/* Long Task Banner */}
      {longTaskBanner && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {operationProgress.phase || 'Processing your request...'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {operationProgress.isActive 
                    ? `${operationProgress.elapsedMinutes} min elapsed • Expected: ${operationProgress.expectedDuration} min`
                    : 'This might take a few minutes. You can continue using the app.'
                  }
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLongTaskBanner(false)}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* AI Input */}
      <AIInputWithLoading
        placeholder={randomPlaceholder}
        value={message}
        onChange={handleChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={!currentProject?.project_id}
        className="p-4"
      />
    </div>
  );
}