'use client';

import { useChatStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Plus } from 'lucide-react';

export default function Sidebar() {
  const { currentProject, createNewProject } = useChatStore();
  
  if (!currentProject) return null;
  
  const handleNewProject = () => {
    if (confirm('Are you sure you want to start a new project? This will save your current progress.')) {
      createNewProject();
    }
  };
  
  return (
    <div className="w-80 border-r border-border bg-card p-4 space-y-4">
      {/* Project Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Holly Studio</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewProject}
            className="gap-2"
          >
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Project: {currentProject.project_id.slice(0, 8)}...
        </div>
      </div>
      
      {/* Current Phase */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Current Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="text-xs">
            {currentProject.phase || 'Initial'}
          </Badge>
        </CardContent>
      </Card>
      
      {/* Core Idea */}
      {currentProject.assets.core_idea && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Core Idea</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {currentProject.assets.core_idea}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Checklist */}
      {currentProject.checklist.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Checklist</CardTitle>
            <CardDescription>
              {currentProject.checklist.filter(item => item.completed).length} / {currentProject.checklist.length} completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentProject.checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {item.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Budget (if available) */}
      {currentProject.budget && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Spent</span>
                <span>${currentProject.budget.spent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total</span>
                <span>${currentProject.budget.total}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-holly-accent h-2 rounded-full transition-all"
                  style={{ 
                    width: `${Math.min(100, (currentProject.budget.spent / currentProject.budget.total) * 100)}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* References */}
      {currentProject.assets.references && currentProject.assets.references.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">References</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {currentProject.assets.references.map((ref, index) => (
                <div key={index} className="text-xs text-muted-foreground truncate">
                  {ref}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}