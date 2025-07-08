'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store';
import MessageBubble from './MessageBubble';

export default function ChatLog() {
  const { currentProject } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentProject?.history]);
  
  if (!currentProject) {
    return null;
  }
  
  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {currentProject.history.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Welcome to Holly Studio</h3>
            <p className="text-sm">Start a conversation to begin your creative project</p>
          </div>
        </div>
      ) : (
        currentProject.history.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      )}
    </div>
  );
}