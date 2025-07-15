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
    references?: Array<{
      asset_id: string;
      image_url: string;
      reference_image_url: string;
      description: string;
    }>;
    style_profile?: string | null;
    style_consistency?: Record<string, unknown>;
    // Extended n8n state structure
    script?: string;
    final_video?: string | null;
    music_audio?: string | null;
    video_clips?: string[];
    final_images?: string[];
    product_type?: string;
    project_goal?: string;
    narration_audio?: string | null;
    target_audience?: string;
    image_candidates?: Array<{
      url: string;
      attempt: number;
      feedback: string | null;
      scene_index: number;
    }>;
    product_image_url?: string;
    product_description?: string;
    current_step_info?: {
      pending_question: string;
    };
    phase?: string;
  };
  phase: string;
  checklist: Array<{
    id: string;
    text: string;
    completed: boolean;
  }> | {
    idea_approved?: boolean;
    consistency_complete?: boolean;
    images_approved?: boolean;
    script_approved?: boolean;
    assembly_complete?: boolean;
    narration_generated?: boolean;
    video_clips_generated?: boolean;
  };
  budget?: {
    spent: number;
    total: number;
  };
  consistency_flags?: {
    has_style_profile?: boolean;
    has_references?: boolean;
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
  chat_id: string;
  previous_messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
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