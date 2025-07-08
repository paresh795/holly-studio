'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useChatStore } from '@/store';
import { sendWebhookMessage } from '@/lib/webhook';
import { processMessageUrls } from '@/lib/media-detection';
import { Message } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';

export default function ChatComposer() {
  const [message, setMessage] = useState('');
  const [showLongTaskWarning, setShowLongTaskWarning] = useState(false);
  const { currentProject, addMessage, setError } = useChatStore();
  
  const mutation = useMutation({
    mutationFn: async (userMessage: string) => {
      if (!currentProject) throw new Error('No active project');
      
      const response = await sendWebhookMessage({
        project_id: currentProject.project_id,
        message: userMessage
      });
      
      return response;
    },
    onSuccess: async (response) => {
      // Process media URLs in the response
      const mediaTypes = await processMessageUrls(response.response_to_user);
      
      // Add assistant message
      const assistantMessage: Message = {
        id: uuidv4(),
        content: response.response_to_user,
        role: 'assistant',
        timestamp: new Date(),
        mediaUrls: mediaTypes.map(m => m.url)
      };
      
      addMessage(assistantMessage);
      
      // Update project state if provided
      if (response.updatedStateJson) {
        // This would update the store with the new state
        // For now, we'll just update the current project
      }
    },
    onError: (error) => {
      toast.error('Failed to send message', {
        description: error.message,
        action: {
          label: 'Retry',
          onClick: () => mutation.mutate(message)
        }
      });
      setError(error.message);
    }
  });
  
  // Show long task warning after 5 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (mutation.isPending) {
      timer = setTimeout(() => {
        setShowLongTaskWarning(true);
      }, 5000);
    } else {
      setShowLongTaskWarning(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [mutation.isPending]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentProject) return;
    
    // Add user message immediately
    const userMessage: Message = {
      id: uuidv4(),
      content: message,
      role: 'user',
      timestamp: new Date()
    };
    
    addMessage(userMessage);
    
    // Send to webhook
    mutation.mutate(message);
    
    // Clear input
    setMessage('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  return (
    <div className="border-t border-border bg-background p-4">
      {showLongTaskWarning && (
        <div className="mb-4 p-3 bg-holly-accent-muted border border-holly-accent/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-holly-fg">
            <Loader2 className="h-4 w-4 animate-spin text-holly-accent" />
            <span>
              <strong>Long task detected:</strong> Video rendering and complex operations can take up to 10 minutes. 
              Please be patient while Holly processes your request.
            </span>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-1 min-h-[44px] resize-none"
          disabled={mutation.isPending}
        />
        <Button
          type="submit"
          disabled={!message.trim() || mutation.isPending}
          className="bg-holly-accent hover:bg-holly-accent/90"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
      
      {mutation.isPending && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sending message...
        </div>
      )}
    </div>
  );
}