import { WebhookRequest, WebhookResponse, ProjectState } from '@/types';

// Enhanced types for long-running operations
interface AsyncOperationResponse {
  operationId: string;
  status: 'accepted';
  message: string;
  estimatedTime: string;
}

interface LongRunningOperationState {
  isActive: boolean;
  operationId: string | null;
  startTime: number | null;
  expectedDuration: number; // in minutes
  lastSupabaseCheck: number | null;
}

// Global state for tracking long operations
let currentLongOperation: LongRunningOperationState = {
  isActive: false,
  operationId: null,
  startTime: null,
  expectedDuration: 8, // Default 8 minutes for video generation
  lastSupabaseCheck: null
};

export async function sendWebhookMessage(request: WebhookRequest): Promise<WebhookResponse> {
  try {
    // Use the Next.js API route proxy instead of direct webhook calls
    const response = await fetch('/api/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Handle specific error types from the API
      if (response.status === 408) {
        throw new Error('Request timeout. Image generation can take up to 10 minutes. Your request is still being processed.');
      }
      
      if (response.status === 503) {
        throw new Error('Unable to connect to the processing service. Please check your network connection and try again.');
      }
      
      if (response.status === 524) {
        throw new Error('Operation timed out at the gateway level. For complex operations like image generation, this is normal. Your request is likely still processing in the background.');
      }
      
      if (response.status === 500 && errorData.error?.includes('not configured')) {
        throw new Error('Webhook URL not configured. Please set NEXT_PUBLIC_N8N_WEBHOOK_URL in your environment variables.');
      }
      
      throw new Error(errorData.error || `Request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if this is an async operation response
    if (response.status === 202 && data.operationId) {
      console.log('🚀 Starting intelligent operation monitoring for:', data.operationId);
      return await pollForOperationCompletion(data as AsyncOperationResponse, request);
    }

    // Return immediate response for quick operations
    return data as WebhookResponse;
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Enhanced error recovery for webhook requests
    if (error instanceof Error) {
      // Handle JSON parsing errors gracefully
      if (error.message.includes('JSON')) {
        throw new Error('Server returned invalid response format. Please try again.');
      }
      
      // Handle network errors with more user-friendly messages
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new Error('Network connection failed. Please check your connection and try again.');
      }
      
      // Handle timeout errors
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out. For complex operations, this may be normal and your request is likely still processing.');
      }
    }
    
    throw error;
  }
}

/**
 * HYBRID POLLING SYSTEM WITH DATABASE FALLBACK
 * Primary path: Webhook polling for quick operations (<2 minutes)
 * Fallback path: Database polling for long operations (video generation, etc.)
 * Implements intelligent switching between polling modes based on operation duration
 */
async function pollForOperationCompletion(
  operationResponse: AsyncOperationResponse, 
  originalRequest: WebhookRequest
): Promise<WebhookResponse> {
  
  const { operationId } = operationResponse;
  
  // 🔧 CRITICAL FIX: Capture baseline state BEFORE operation starts
  console.log(`📊 Capturing baseline state before operation ${operationId} starts...`);
  let operationBaseline: any = null;
  
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: supabaseProject } = await supabase
      .from('project_states')
      .select('state_data, updated_at')
      .eq('project_id', originalRequest.project_id)
      .single();
    
    if (supabaseProject && supabaseProject.state_data?.history) {
      const latestMessage = supabaseProject.state_data.history[supabaseProject.state_data.history.length - 1] as any;
      operationBaseline = {
        latestMessageContent: latestMessage?.content || latestMessage?.message || '',
        latestMessageTimestamp: latestMessage?.timestamp || latestMessage?.created_at || '',
        assetHash: JSON.stringify(supabaseProject.state_data.assets || {}),
        historyLength: supabaseProject.state_data.history.length
      };
      
      console.log(`📊 BASELINE CAPTURED: ${operationBaseline.historyLength} messages, latest: "${operationBaseline.latestMessageContent.substring(0, 100)}..."`);
    } else {
      operationBaseline = {
        latestMessageContent: '',
        latestMessageTimestamp: '',
        assetHash: '{}',
        historyLength: 0
      };
      console.log(`📊 BASELINE CAPTURED: Empty state (new project)`);
    }
  } catch (error) {
    console.error('❌ Failed to capture operation baseline:', error);
    operationBaseline = {
      latestMessageContent: '',
      latestMessageTimestamp: '',
      assetHash: '{}',
      historyLength: 0
    };
  }
  
  // Set up operation tracking
  currentLongOperation = {
    isActive: true,
    operationId,
    startTime: Date.now(),
    expectedDuration: 8, // Will be adjusted based on operation type
    lastSupabaseCheck: Date.now()
  };
  
  console.log(`🚀 Starting intelligent monitoring for operation ${operationId}`);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let pollInterval = 500; // Start with fast polling
    let gatewayTimeouts = 0;
    let pollCount = 0;
    
    const poll = async () => {
      try {
        pollCount++;
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);
        const elapsedMinutes = Math.floor(elapsed / 60000);
        
        // Adaptive polling strategy based on elapsed time
        if (elapsed < 30000) {
          // Phase 1: Fast polling (0-30 seconds) - Most operations complete here
          pollInterval = 500;
        } else if (elapsed < 120000) {
          // Phase 2: Medium polling (30s-2min) - Image generation, etc.
          pollInterval = 2000;
        } else {
          // Phase 3: Long operation detected - Switch to database polling fallback
          console.log(`🔄 [${elapsedMinutes}m] SWITCHING TO DATABASE POLLING FALLBACK - webhook polling complete`);
          console.log(`📊 Activating NEW database monitoring system for ${operationId}`);
          startDatabasePollingFallback(originalRequest.project_id, operationId, operationBaseline, resolve, reject);
          return;
        }
        
        // Poll the dedicated operation status API
        console.log(`🔍 [${elapsedSeconds}s] Polling operation-status API for ${operationId}...`);
        const response = await fetch(`/api/operation-status/${operationId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`⚠️ [${elapsedSeconds}s] Operation not found in status API - checking database fallback`);
            
            // Switch to database polling fallback after 30 seconds of 404s
            if (elapsed > 30000) {
              console.log(`🔄 [${elapsedSeconds}s] Switching to database polling fallback after 30s of 404s`);
              
              // Add a small delay to let the webhook complete storing the result
              setTimeout(() => {
                startDatabasePollingFallback(originalRequest.project_id, operationId, operationBaseline, resolve, reject);
              }, 2000);
              return;
            } else {
              // Continue polling for the first 30 seconds
              console.log(`🔄 [${elapsedSeconds}s] Operation not found in store - continuing to poll (webhook likely completing)`);
              setTimeout(poll, pollInterval);
            return;
            }
          }
          
          if (response.status === 524 || response.status === 502 || response.status === 503) {
            gatewayTimeouts++;
            console.log(`🌐 [${elapsedSeconds}s] Gateway timeout ${gatewayTimeouts} - operation continues`);
            
            // For quick operations, gateway timeouts might indicate completion
            if (elapsed < 60000 && gatewayTimeouts >= 3) {
              console.log(`⚡ [${elapsedSeconds}s] Multiple gateway timeouts during quick operation - checking Supabase`);
              
              try {
                const { useChatStore } = await import('@/store');
                await useChatStore.getState().refreshProjectStateFromSupabase(originalRequest.project_id);
                const project = useChatStore.getState().currentProject;
                
                if (isOperationCompleteFromState(project, operationId)) {
                  console.log(`✅ [${elapsedSeconds}s] Quick operation completed via Supabase check`);
                  currentLongOperation.isActive = false;
                  resolve({
                    response_to_user: "Operation completed successfully! Check the sidebar for updates.",
                    updatedStateJson: {
                      project_id: originalRequest.project_id,
                      history: project?.history || [],
                      assets: project?.assets || {},
                      phase: project?.phase || 'completed',
                      checklist: project?.checklist || {},
                      budget: project?.budget || { spent: 0, total: 15 }
                    }
                  });
                  return;
                }
              } catch {
                // Continue polling if Supabase check fails
              }
            }
            
            // Continue polling with backoff
            setTimeout(poll, pollInterval * 2);
            return;
          }
          
          throw new Error(`Operation status check failed: ${response.status}`);
        }
        
        let data;
        try {
          const responseText = await response.text();
          if (!responseText || responseText.trim() === '') {
            console.log(`⚠️ [${elapsedSeconds}s] Empty response from operation status API - continuing to poll`);
            setTimeout(poll, pollInterval);
            return;
          }
          data = JSON.parse(responseText);
          console.log(`🔍 [${elapsedSeconds}s] Parsed status data:`, JSON.stringify(data, null, 2));
        } catch (jsonError) {
          console.error(`❌ [${elapsedSeconds}s] Invalid JSON response from operation status API:`, jsonError);
          // Continue polling instead of failing immediately
          setTimeout(poll, pollInterval * 2);
          return;
        }
        
        // CRITICAL DEBUG: Log what we actually received
        console.log(`🔍 [${elapsedSeconds}s] FRONTEND POLLING RECEIVED:`, {
          status: data.status,
          hasResult: !!data.result,
          resultType: typeof data.result,
          resultKeys: data.result ? Object.keys(data.result) : null,
          timestamp: data.timestamp,
          operationId: data.operationId
        });
        
        if (data.status === 'completed') {
          console.log(`✅ [${elapsedSeconds}s] Operation completed via status API (${pollCount} polls)`);
          console.log(`🔍 [${elapsedSeconds}s] Completion data:`, JSON.stringify(data, null, 2));
          
          currentLongOperation.isActive = false;
          
          // CRITICAL DEBUG: Log the decision making process
          console.log(`🔍 [${elapsedSeconds}s] RESULT DECISION PROCESS:`);
          console.log(`📊 data.result exists: ${!!data.result}`);
          console.log(`📊 data.result type: ${typeof data.result}`);
          
          if (data.result) {
            console.log(`📊 data.result keys: ${Object.keys(data.result)}`);
            console.log(`📊 data.result preview:`, JSON.stringify(data.result, null, 2).substring(0, 300) + '...');
          }
          
          // Handle case where result might be structured differently
          if (data.result) {
            console.log(`✅ [${elapsedSeconds}s] Using direct result from operation`);
            console.log(`🎯 [${elapsedSeconds}s] RESOLVING WITH RESULT:`, JSON.stringify(data.result, null, 2).substring(0, 200) + '...');
          resolve(data.result);
          } else {
            console.log(`⚠️ [${elapsedSeconds}s] No result found - creating fallback response`);
            // Create fallback response to prevent message loss
            const fallbackResponse = {
              response_to_user: "Your operation completed successfully! Please check the sidebar for updates.",
              updatedStateJson: {
                project_id: originalRequest.project_id,
                history: [],
                assets: {},
                phase: 'completed',
                checklist: {}
              }
            };
            console.log(`🎯 [${elapsedSeconds}s] RESOLVING WITH FALLBACK:`, JSON.stringify(fallbackResponse, null, 2));
            resolve(fallbackResponse);
          }
          return;
        }
        
        if (data.status === 'error') {
          console.error(`❌ [${elapsedSeconds}s] Operation failed:`, data.error);
          currentLongOperation.isActive = false;
          reject(new Error(data.error || 'Operation failed'));
          return;
        }
        
        // CRITICAL FIX: Time-based database polling fallback for long operations
        if (data.status === 'pending' && elapsed > 60000) { // 60 seconds timeout
          console.log(`⏰ [${elapsedSeconds}s] Operation pending for over 60s - switching to database polling fallback`);
          console.log(`🔄 [${elapsedSeconds}s] This likely means n8n completed but webhook notification failed`);
          console.log(`📊 [${elapsedSeconds}s] Final operation store status before fallback:`, JSON.stringify(data, null, 2));
          
          // Mark this operation as switched to database polling to avoid conflicts
          currentLongOperation.isActive = false;
          
          // Switch to database polling to find the result in Supabase
          setTimeout(() => {
            startDatabasePollingFallback(originalRequest.project_id, operationId, operationBaseline, resolve, reject);
          }, 1000);
          return;
        }
        
        // Log progress for longer operations
        if (elapsedSeconds > 10 && pollCount % 10 === 0) {
          console.log(`⏳ [${elapsedSeconds}s] Operation still running (${pollCount} polls)`);
        }
        
        // Continue polling
        setTimeout(poll, pollInterval);
        
      } catch (error) {
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);
        
        console.error(`❌ [${elapsedSeconds}s] Polling error:`, error);
        
        // Enhanced error recovery with specific handling for different error types
        if (error instanceof Error && error.message.includes('JSON')) {
          console.log(`🔄 [${elapsedSeconds}s] JSON parsing error - implementing recovery strategy`);
          
          // For JSON errors, increase retry interval and continue
          if (elapsed < 120000) { // Continue trying for 2 minutes
            setTimeout(poll, pollInterval * 3);
            return;
          }
        }
        
        // For network errors or timeouts, implement exponential backoff
        if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('timeout'))) {
          console.log(`🔄 [${elapsedSeconds}s] Network error - implementing exponential backoff`);
          
          if (elapsed < 300000) { // Continue trying for 5 minutes
            setTimeout(poll, Math.min(pollInterval * 4, 10000)); // Cap at 10 seconds
            return;
          }
        }
        
        // For operations longer than 1 minute, switch to database polling fallback
        if (elapsed > 60000) {
          console.log(`🔄 [${elapsedSeconds}s] Polling errors during long operation - switching to database polling fallback`);
          startDatabasePollingFallback(originalRequest.project_id, operationId, operationBaseline, resolve, reject);
          return;
        }
        
        // For quick operations, retry with backoff
        setTimeout(poll, pollInterval * 2);
      }
    };
    
    // Start polling immediately
    poll();
  });
}

/**
 * EXTRACT LATEST AI RESPONSE FROM HISTORY
 * Gets the most recent assistant message added after operation started
 */
function extractLatestAssistantMessage(project: ProjectState | null, initialHistoryLength: number): string | null {
  if (!project?.history || !Array.isArray(project.history)) {
    console.log('❌ No history array found in project');
    return null;
  }
  
  const isFullHistorySearch = initialHistoryLength === 0;
  console.log(`🔍 History analysis: total ${project.history.length} messages, initial ${initialHistoryLength} (${isFullHistorySearch ? 'FULL SEARCH' : 'NEW MESSAGES ONLY'})`);
  
  // Check if we have new messages beyond the initial count
  if (project.history.length <= initialHistoryLength) {
    console.log('❌ No new messages found - history length unchanged');
    return null;
  }
  
  // Get messages added after operation started
  const newMessages = project.history.slice(initialHistoryLength);
  console.log(`🔍 Found ${newMessages.length} messages to check:`, newMessages.map(msg => ({ role: msg.role, hasContent: !!msg.content, contentLength: msg.content?.length || 0 })));
  
  // Find the latest assistant message
  for (let i = newMessages.length - 1; i >= 0; i--) {
    const msg = newMessages[i];
    // Handle both normalized (content) and raw Supabase (message) formats
    const messageText = msg.content || (msg as any).message || '';
    console.log(`🔍 Checking message ${i}: role=${msg.role}, hasContent=${!!messageText}, text=${messageText.substring(0, 100)}...`);
    
    if (msg.role === 'assistant' && messageText.trim()) {
      console.log('✅ Assistant message found:', messageText.substring(0, 200) + '...');
      return messageText;
    }
  }
  
  console.log(`❌ No assistant messages found in ${isFullHistorySearch ? 'entire history' : 'new messages'}`);
  return null;
}

/**
 * GENERATE FALLBACK MESSAGE WHEN AI RESPONSE NOT FOUND
 * Creates informative message based on detected changes
 */
function generateFallbackMessage(project: ProjectState | null): string {
  if (!project?.assets) {
    return 'Your operation completed successfully! Please check the sidebar for updates.';
  }
  
  const updates: string[] = [];
  
  // Check for new video clips
  if (project.assets.video_clips && Array.isArray(project.assets.video_clips)) {
    const videoCount = project.assets.video_clips.length;
    if (videoCount > 0) {
      updates.push(`${videoCount} video clip${videoCount > 1 ? 's' : ''} generated`);
    }
  }
  
  // Check for new images
  if (project.assets.final_images && Array.isArray(project.assets.final_images)) {
    const imageCount = project.assets.final_images.length;
    if (imageCount > 0) {
      updates.push(`${imageCount} image${imageCount > 1 ? 's' : ''} available`);
    }
  }
  
  // Check for final video
  if (project.assets.final_video) {
    updates.push('final video completed');
  }
  
  // Check for narration
  if (project.assets.narration_audio) {
    updates.push('narration audio generated');
  }
  
  if (updates.length > 0) {
    return `🎬 Your operation completed successfully! Updates: ${updates.join(', ')}. Check the sidebar for details.`;
  }
  
  return 'Your operation completed successfully! Please check the sidebar for updates.';
}

/**
 * INTELLIGENT STATE-BASED COMPLETION DETECTION
 * Detects completion by analyzing state changes in the project
 */
function isOperationCompleteFromState(project: ProjectState | null, operationId: string): boolean {
  if (!project || !project.assets) return false;
  
  // Check for video generation completion
  if (operationId.includes('video') || project.phase === 'video_generation') {
    // Video generation is complete if we have video clips or final video
    if (project.assets.video_clips && project.assets.video_clips.length > 0) {
      console.log('✅ Video generation detected: video_clips array populated');
      return true;
    }
    
    if (project.assets.final_video) {
      console.log('✅ Video generation detected: final_video available');
      return true;
    }
    
    if (project.checklist && !Array.isArray(project.checklist) && project.checklist.video_clips_generated === true) {
      console.log('✅ Video generation detected: checklist updated');
      return true;
    }
  }
  
  // Check for other operation types
  if (project.checklist && !Array.isArray(project.checklist) && project.checklist.assembly_complete === true) {
    console.log('✅ Assembly completion detected');
    return true;
  }
  
  return false;
}

/**
 * DATABASE POLLING FALLBACK SYSTEM
 * Monitors database for completion when webhook response is lost due to gateway timeouts
 * Used as fallback for long-running operations (video generation, etc.)
 */
async function startDatabasePollingFallback(
  projectId: string, 
  operationId: string, 
  operationBaseline: any,
  resolve: (value: WebhookResponse) => void,
  reject: (reason: Error) => void
) {
  console.log(`🔄 DATABASE POLLING FALLBACK ACTIVATED for operation ${operationId}`);
  console.log(`⏱️ Will monitor for up to 20 minutes for completion`);
  console.log(`📊 Checking Supabase for completed operation that didn't notify webhook properly`);
  
  // IMPORTANT: Set current operation to active for database polling
  currentLongOperation.isActive = true;
  currentLongOperation.operationId = operationId;
  
  const maxMonitoringTime = 20 * 60 * 1000; // 20 minutes total
  const pollInterval = 15000; // Poll every 15 seconds
  const startTime = Date.now();
  let pollCount = 0;
  
  // 🔧 CRITICAL FIX: Use baseline captured BEFORE operation started
  console.log(`📊 USING PRE-OPERATION BASELINE for comparison:`);
  console.log(`📊 Baseline content: "${operationBaseline.latestMessageContent.substring(0, 100)}..."`);
  console.log(`📊 Baseline timestamp: ${operationBaseline.latestMessageTimestamp}`);
  console.log(`📊 Baseline history length: ${operationBaseline.historyLength}`);
  console.log(`📊 Baseline asset hash length: ${operationBaseline.assetHash.length} chars`);
  
  // Extract baseline values for comparison
  const initialLatestMessageContent = operationBaseline.latestMessageContent;
  const initialLatestMessageTimestamp = operationBaseline.latestMessageTimestamp;
  const initialAssetHash = operationBaseline.assetHash;
  
  console.log(`🚀 Starting database polling immediately (no delay needed)...`);
  
  const pollDatabase = async () => {
    try {
      pollCount++;
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.floor(elapsed / 60000);
      
      console.log(`🔄 [${elapsedMinutes}m] Database poll ${pollCount} for ${operationId}`);
      
      // Check timeout first
      if (elapsed > maxMonitoringTime) {
        console.log(`⏰ [${elapsedMinutes}m] Maximum polling time reached`);
        currentLongOperation.isActive = false;
        
        resolve({
          response_to_user: `⏳ Your operation has been running for ${elapsedMinutes} minutes. Long operations can take up to 20 minutes. Please check the sidebar for updates, or refresh the page to check the latest status.`,
          updatedStateJson: {
            project_id: projectId,
            history: [],
            assets: {},
            phase: 'processing',
            checklist: {},
            budget: { spent: 0, total: 15 }
          }
        });
        return;
      }
      
      // Fetch fresh Supabase data directly using the CORRECT table
      const { supabase } = await import('@/lib/supabase');
      const { data: currentSupabaseProject } = await supabase
        .from('project_states')  // ✅ Fixed: Use correct table
        .select('state_data, updated_at')  // ✅ Fixed: Select correct fields
        .eq('project_id', projectId)  // ✅ Fixed: Use correct field name
        .single();
      
      console.log(`📊 [${elapsedMinutes}m] Current Supabase state info:`, {
        hasProject: !!currentSupabaseProject,
        phase: currentSupabaseProject?.state_data?.phase,
        historyLength: currentSupabaseProject?.state_data?.history?.length || 0,
        assetsCount: Object.keys(currentSupabaseProject?.state_data?.assets || {}).length,
        lastUpdated: currentSupabaseProject?.updated_at || 'unknown'
      });
      
      if (!currentSupabaseProject) {
        console.log(`⚠️ [${elapsedMinutes}m] No project data available - continuing polling`);
        setTimeout(pollDatabase, pollInterval);
        return;
      }
      
      // PROFESSIONAL CONTENT-BASED COMPARISON
      // Compare latest message content instead of array length
      const currentHistory = currentSupabaseProject.state_data?.history || [];
      const currentLatestMessage = currentHistory[currentHistory.length - 1];
      const currentLatestContent = currentLatestMessage?.content || currentLatestMessage?.message || '';
      const currentLatestTimestamp = currentLatestMessage?.timestamp || currentLatestMessage?.created_at || '';
      
      // Compare current assets with initial baseline
      const currentAssets = currentSupabaseProject.state_data?.assets || {};
      const currentAssetHash = JSON.stringify(currentAssets);
      
      console.log(`🔍 [${elapsedMinutes}m] CONTENT COMPARISON:`, {
        contentChanged: currentLatestContent !== initialLatestMessageContent,
        timestampChanged: currentLatestTimestamp !== initialLatestMessageTimestamp,
        assetsChanged: currentAssetHash !== initialAssetHash,
        currentContentPreview: currentLatestContent.substring(0, 100) + '...',
        initialContentPreview: initialLatestMessageContent.substring(0, 100) + '...'
      });
      
      // Check for completion using content-based detection
      const contentChanged = currentLatestContent !== initialLatestMessageContent;
      const timestampChanged = currentLatestTimestamp !== initialLatestMessageTimestamp;
      const assetsChanged = currentAssetHash !== initialAssetHash;
      
      if (contentChanged || timestampChanged || assetsChanged) {
        console.log(`✅ [${elapsedMinutes}m] COMPLETION DETECTED! Content or assets changed.`);
        
        // Find the latest assistant message for response
        const latestAssistantMessage = currentHistory
          .slice()
          .reverse()
          .find((msg: any) => msg.role === 'assistant' && (msg.content || msg.message));
        
        if (latestAssistantMessage) {
          const messageText = latestAssistantMessage.content || latestAssistantMessage.message;
          console.log(`🎯 [${elapsedMinutes}m] RETURNING ASSISTANT MESSAGE from database polling`);
          console.log(`📝 [${elapsedMinutes}m] Message preview:`, messageText.substring(0, 200) + '...');
          
          // Clean up and return success
        currentLongOperation.isActive = false;
          currentLongOperation.operationId = null;
        
        resolve({
            response_to_user: messageText,
          updatedStateJson: {
            project_id: projectId,
              history: currentHistory || [],
              assets: currentSupabaseProject.state_data?.assets || {},
              phase: currentSupabaseProject.state_data?.phase || 'completed',
              checklist: currentSupabaseProject.state_data?.checklist || {},
              budget: currentSupabaseProject.state_data?.budget || { spent: 0, total: 15 }
          }
        });
        return;
      }
      
        console.log(`⚠️ [${elapsedMinutes}m] Changes detected but no assistant message found - continuing`);
      }
      
      console.log(`⏳ [${elapsedMinutes}m] No completion detected - continuing to poll`);
      setTimeout(pollDatabase, pollInterval);
      
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.floor(elapsed / 60000);
      
      console.error(`❌ [${elapsedMinutes}m] Database polling error:`, error);
      
      // Continue polling on error, but with longer interval
      setTimeout(pollDatabase, pollInterval * 2);
    }
  };
  
  // Start the polling
  pollDatabase();
}



/**
 * Get current operation status for UI
 */
export function getCurrentOperationStatus(): LongRunningOperationState {
  return { ...currentLongOperation };
}