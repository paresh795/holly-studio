'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatLog from './ChatLog';
import ChatComposer from './ChatComposer';
import Sidebar from './Sidebar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { PanelLeft } from 'lucide-react';

const queryClient = new QueryClient();

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex bg-background">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="hidden md:block">
            <Sidebar />
          </div>
        )}
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Holly Studio</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden md:flex"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Chat Log */}
          <ChatLog />
          
          {/* Chat Composer */}
          <ChatComposer />
        </div>
        
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setSidebarOpen(false)}>
            <div className="absolute right-0 top-0 h-full w-80 bg-card" onClick={(e) => e.stopPropagation()}>
              <Sidebar />
            </div>
          </div>
        )}
      </div>
    </QueryClientProvider>
  );
}