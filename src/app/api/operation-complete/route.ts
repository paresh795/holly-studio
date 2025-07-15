import { NextRequest, NextResponse } from 'next/server';
import { operationStore } from '@/lib/operation-store';

interface OperationCompleteRequest {
  operationId: string;
  result: {
    response_to_user: string;
    updatedStateJson: {
      project_id: string;
      assets: any;
      phase: string;
      checklist: any;
      budget: any;
    };
  };
  projectId: string;
}

/**
 * PROFESSIONAL COMPLETION WEBHOOK
 * This endpoint is called by n8n when operations complete
 * Provides immediate, reliable completion notification
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Operation completion webhook called');
    
    const body: OperationCompleteRequest = await request.json();
    const { operationId, result, projectId } = body;
    
    if (!operationId || !result) {
      console.error('❌ Invalid completion request:', body);
      return NextResponse.json({ error: 'operationId and result are required' }, { status: 400 });
    }
    
    console.log(`✅ Operation ${operationId} completed successfully via webhook callback`);
    console.log(`🎬 Result: ${result.response_to_user.substring(0, 100)}...`);
    
    // Store the completed result immediately
    const existingOperation = operationStore.get(operationId);
    operationStore.set(operationId, {
      status: 'completed',
      startTime: existingOperation?.startTime || Date.now(),
      result: {
        response_to_user: result.response_to_user,
        updatedStateJson: {
          project_id: projectId,
          history: [], // Will be merged with existing history in frontend
          assets: result.updatedStateJson.assets || {},
          phase: result.updatedStateJson.phase || 'completed',
          checklist: result.updatedStateJson.checklist || {},
          budget: result.updatedStateJson.budget || { spent: 0, total: 15 }
        }
      }
    });
    
    // Update Supabase with the new state (optional, for backup)
    try {
      const { saveProjectState } = await import('@/lib/supabase');
      await saveProjectState(projectId, result.updatedStateJson);
      console.log(`💾 Saved state to Supabase for project ${projectId}`);
    } catch (error) {
      console.error('⚠️ Failed to save to Supabase (continuing anyway):', error);
    }
    
    // Notify any WebSocket clients (future enhancement)
    // await notifyWebSocketClients(operationId, result);
    
    return NextResponse.json({ 
      success: true, 
      operationId,
      message: 'Operation completion recorded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error processing completion webhook:', error);
    return NextResponse.json({ 
      error: 'Failed to process completion webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    endpoint: 'operation-complete',
    timestamp: new Date().toISOString()
  });
} 