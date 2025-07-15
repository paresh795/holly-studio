import { NextRequest, NextResponse } from 'next/server';
import { WebhookRequest, WebhookResponse } from '@/types';
import { operationStore } from '@/lib/operation-store';

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://placeholder-webhook.com';

// Configure route timeout - this is critical for long operations
export const maxDuration = 900; // 15 minutes for complex operations like image generation

export async function POST(request: NextRequest) {
  try {
    // Check if webhook is configured
    if (WEBHOOK_URL === 'https://placeholder-webhook.com') {
      return NextResponse.json(
        { error: 'Webhook URL not configured. Please set NEXT_PUBLIC_N8N_WEBHOOK_URL in your environment variables.' },
        { status: 500 }
      );
    }

    // Get the request body
    const body = await request.json();
    
    // Generate operation ID for tracking
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Starting operation ${operationId} for request`);
    
    // Initialize operation tracking
    operationStore.set(operationId, {
      status: 'pending',
      startTime: Date.now()
    });
    
    // Start the operation in the background (ALL operations are now async)
    handleWebhookRequest(operationId, body).catch(error => {
      console.error(`Operation ${operationId} failed:`, error);
      operationStore.set(operationId, {
        status: 'error',
        startTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    });
    
    // Return immediate response with operation ID
    return NextResponse.json({
      operationId,
      status: 'accepted',
      message: 'Operation started. Results will be available shortly.',
      estimatedTime: 'Typically 10-60 seconds for text, 2-10 minutes for image generation'
    }, { status: 202 }); // HTTP 202 Accepted
    
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred while processing your request.',
        type: 'server_error' 
      },
      { status: 500 }
    );
  }
}

// Unified webhook handler for ALL operations
async function handleWebhookRequest(operationId: string, body: WebhookRequest) {
  console.log(`Executing operation ${operationId}`);
  
  // Single timeout for all operations - no more sync/async confusion
  const controller = new AbortController();
  const timeout = 900000; // 15 minutes for all operations (increased from 10)
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log(`Starting webhook call for operation ${operationId} (timeout: ${timeout}ms)`);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Holly-Studio/1.0',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle gateway timeouts professionally - DON'T mark as error
      if (response.status === 524 || response.status === 502 || response.status === 503) {
        console.log(`Operation ${operationId} got ${response.status} - gateway timeout, but operation continues`);
        
        // CRITICAL FIX: Keep status as 'pending' instead of 'error'
        // The operation is likely still running successfully in n8n
        operationStore.set(operationId, {
          status: 'pending', // ✅ Continue waiting instead of failing
          startTime: operationStore.get(operationId)?.startTime || Date.now(),
        });
        
        // Let the client-side polling handle the timeout
        // The new hybrid system will take over from here
        return;
      }
      
      // Handle 4xx and 5xx errors, but log more details for debugging
      console.error(`Operation ${operationId} - n8n returned ${response.status}: ${response.statusText}`);
      console.error(`Operation ${operationId} - Request body:`, JSON.stringify(body, null, 2));
      
      // Try to get response body for more context
      let errorDetails = '';
      try {
        const errorText = await response.text();
        errorDetails = errorText.substring(0, 200); // Limit error message length
        console.error(`Operation ${operationId} - Error response:`, errorDetails);
      } catch (e) {
        console.error(`Operation ${operationId} - Could not read error response`);
      }
      
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    // Success! Process the response
    const contentType = response.headers.get('content-type');
    let rawResponse;

    if (contentType && contentType.includes('application/json')) {
      rawResponse = await response.json();
      console.log(`Operation ${operationId} - Raw n8n response:`, JSON.stringify(rawResponse, null, 2));
    } else {
      // Handle non-JSON responses (text)
      rawResponse = await response.text();
      console.log(`Operation ${operationId} - Raw n8n text response:`, rawResponse);
    }

    // Transform n8n response to our expected frontend structure
    let responseData;
    
    if (typeof rawResponse === 'string') {
      // Text response - but still include updated state if we can
      console.log(`Operation ${operationId} - Text response detected, trying to preserve state`);
      
      responseData = {
        response_to_user: rawResponse,
        updatedStateJson: {
          project_id: body.project_id,
          history: [],
          assets: {},
          phase: 'text_interaction',
          checklist: {}
        }
      };
      
      // For text responses, we should try to get state from n8n separately
      // This is a workaround for n8n's dual response modes
      console.log(`Operation ${operationId} - Consider adding state request endpoint to n8n workflow`);
    } else if (Array.isArray(rawResponse) && rawResponse[0]?.state_data) {
      // n8n structured response with state_data
      const stateData = rawResponse[0].state_data;
      console.log(`Operation ${operationId} - Extracted state_data:`, JSON.stringify(stateData, null, 2));
      
      responseData = {
        response_to_user: stateData.current_step_info?.pending_question || 'Operation completed successfully',
        updatedStateJson: {
          project_id: body.project_id,
          phase: stateData.phase || 'initial',
          assets: {
            // Map n8n assets to our structure
            ...stateData.assets,
            phase: stateData.phase // Also store phase in assets for sidebar access
          },
          checklist: stateData.checklist || {},
          budget: stateData.budget || { spent: 0, total: 15 },
          history: [] // Will be merged with existing history in frontend
        }
      };
      
      console.log(`Operation ${operationId} - Transformed for frontend:`, JSON.stringify(responseData, null, 2));
    } else if (rawResponse.response_to_user || rawResponse.updatedStateJson) {
      // Already in our expected format
      responseData = rawResponse;
    } else {
      // Unknown format, create safe fallback
      console.warn(`Operation ${operationId} - Unknown response format:`, rawResponse);
      responseData = {
        response_to_user: 'Operation completed, but response format was unexpected.',
        updatedStateJson: {
          project_id: body.project_id,
          history: [],
          assets: { raw_response: rawResponse },
          phase: 'unknown',
          checklist: {}
        }
      };
    }

    // Store the completed result
    operationStore.set(operationId, {
      status: 'completed',
      startTime: operationStore.get(operationId)?.startTime || Date.now(),
      result: responseData
    });
    
    console.log(`Operation ${operationId} completed successfully`);
    
    // DEBUG: Verify the operation is in the store
    const storedOperation = operationStore.get(operationId);
    if (storedOperation) {
      console.log(`✅ Operation ${operationId} confirmed in store with status: ${storedOperation.status}`);
    } else {
      console.error(`❌ Operation ${operationId} NOT found in store immediately after setting!`);
    }
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle different error types with clear messaging
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log(`Operation ${operationId} timed out after ${timeout}ms`);
        
        // For AbortError, continue monitoring - operation might still complete
        operationStore.set(operationId, {
          status: 'pending',
          startTime: operationStore.get(operationId)?.startTime || Date.now(),
        });
        
        // Let the client-side hybrid polling system handle the timeout
        return;
      }
      
      if (error.message.includes('524') || error.message.includes('timeout')) {
        console.log(`Operation ${operationId} has gateway timeout: ${error.message}`);
        
        // Continue monitoring instead of failing
        operationStore.set(operationId, {
          status: 'pending',
          startTime: operationStore.get(operationId)?.startTime || Date.now(),
        });
        
        // Let the client-side hybrid polling system handle the timeout
        return;
      }
    }
    
    // For actual errors (not timeouts), mark as failed
    operationStore.set(operationId, {
      status: 'error',
      startTime: operationStore.get(operationId)?.startTime || Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    console.error(`Operation ${operationId} failed:`, error);
  }
}



// Status check endpoint
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const operationId = url.searchParams.get('operationId');
  
  if (!operationId) {
    return NextResponse.json({ error: 'Operation ID required' }, { status: 400 });
  }
  
  const operation = operationStore.get(operationId);
  
  if (!operation) {
    return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
  }
  
  // Clean up completed operations older than 1 hour
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  if (operation.startTime < oneHourAgo && operation.status !== 'pending') {
    operationStore.delete(operationId);
    return NextResponse.json({ error: 'Operation expired' }, { status: 410 });
  }
  
  return NextResponse.json({
    operationId,
    status: operation.status,
    startTime: operation.startTime,
    duration: Date.now() - operation.startTime,
    result: operation.result,
    error: operation.error
  });
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 