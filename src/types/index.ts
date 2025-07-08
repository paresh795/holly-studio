export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  mediaUrls?: string[];
  error?: string;
}

export interface ProjectState {
  project_id: string;
  history: Message[];
  assets: {
    core_idea?: string;
    references?: string[];
    style_consistency?: Record<string, unknown>;
  };
  phase: string;
  checklist: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  budget?: {
    spent: number;
    total: number;
  };
}

export interface Project {
  id: string;
  name: string;
  lastSeen: Date;
}

export interface WebhookRequest {
  project_id: string;
  message: string;
}

export interface WebhookResponse {
  response_to_user: string;
  updatedStateJson: ProjectState;
}

export interface MediaType {
  url: string;
  type: 'image' | 'video' | 'audio' | 'link';
  contentType?: string;
}