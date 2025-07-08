'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/store';
import { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectGate({ children }: { children: React.ReactNode }) {
  const { currentProject, createNewProject, loadProject } = useChatStore();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Check if there's a current project ID in localStorage
    const storedProjectId = localStorage.getItem('hollyProjectId');
    const projects = loadProjectsFromLocalStorage();
    
    setRecentProjects(projects);
    
    if (storedProjectId) {
      // Try to load the project
      loadProject(storedProjectId).then(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [loadProject]);
  
  const loadProjectsFromLocalStorage = (): Project[] => {
    try {
      const stored = localStorage.getItem('hollyProjects');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };
  
  const handleNewProject = () => {
    createNewProject();
  };
  
  const handleContinueProject = (projectId: string) => {
    localStorage.setItem('hollyProjectId', projectId);
    loadProject(projectId);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-holly-bg dark:bg-holly-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-holly-accent"></div>
      </div>
    );
  }
  
  if (!currentProject) {
    return (
      <div className="min-h-screen bg-holly-bg dark:bg-holly-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-holly-fg dark:text-holly-fg">
              Holly Studio
            </CardTitle>
            <CardDescription>
              Premium-minimal interface for your creative projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleNewProject}
              className="w-full bg-holly-accent hover:bg-holly-accent/90 text-white"
            >
              New Project
            </Button>
            
            {recentProjects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-holly-fg dark:text-holly-fg">
                  Recent Projects
                </h3>
                <div className="space-y-2">
                  {recentProjects.slice(0, 3).map((project) => (
                    <Button
                      key={project.id}
                      variant="outline"
                      onClick={() => handleContinueProject(project.id)}
                      className="w-full justify-start text-left"
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(project.lastSeen).toLocaleDateString()}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return <>{children}</>;
}