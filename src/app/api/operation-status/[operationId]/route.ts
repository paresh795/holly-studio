import { NextRequest, NextResponse } from 'next/server';
import { operationStore } from '@/lib/operation-store';

interface RouteParams {
  params: {
    operationId: string;
  };
}

/**
 * OPERATION STATUS API
 * Direct endpoint for checking operation status
 * Used for reliable polling without webhook complexity
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { operationId } = await params;
    
    if (!operationId) {
      console.log('❌ Operation status API: Missing operation ID');
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 });
    }
    
    // Add some basic validation for operation ID format
    if (!operationId.startsWith('op_')) {
      console.log(`❌ Operation status API: Invalid operation ID format: ${operationId}`);
      return NextResponse.json({ 
        error: 'Invalid operation ID format',
        operationId,
        message: 'Operation ID must start with "op_"'
      }, { status: 400 });
    }
    
    const operation = operationStore.get(operationId);
    
    if (!operation) {
      console.log(`❌ Operation status API: Operation not found: ${operationId}`);
      console.log(`📊 Current operations in store:`, Array.from(operationStore.keys()));
      return NextResponse.json({ 
        error: 'Operation not found',
        operationId,
        message: 'Operation may have expired or never existed',
        availableOperations: Array.from(operationStore.keys())
      }, { status: 404 });
    }
    
    // Calculate duration
    const duration = Date.now() - operation.startTime;
    const durationSeconds = Math.floor(duration / 1000);
    const durationMinutes = Math.floor(duration / 60000);
    
    // Clean up old completed operations (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (operation.startTime < oneHourAgo && operation.status !== 'pending') {
      operationStore.delete(operationId);
      return NextResponse.json({ 
        error: 'Operation expired',
        operationId,
        message: 'Operation completed more than 1 hour ago and has been cleaned up'
      }, { status: 410 });
    }
    
    // CRITICAL DEBUG: Log details about completed operations
    if (operation.status === 'completed') {
      console.log(`🔍 DETAILED COMPLETED OPERATION DEBUG for ${operationId}:`);
      console.log(`📊 Status: ${operation.status}`);
      console.log(`📊 Has result: ${!!operation.result}`);
      console.log(`📊 Result type: ${typeof operation.result}`);
      console.log(`📊 Result keys: ${operation.result ? Object.keys(operation.result) : 'N/A'}`);
      console.log(`📊 Start time: ${new Date(operation.startTime).toISOString()}`);
      console.log(`📊 Duration: ${durationMinutes}m ${durationSeconds % 60}s`);
      
      if (operation.result) {
        console.log(`📊 Result preview:`, JSON.stringify(operation.result, null, 2).substring(0, 500) + '...');
      }
    }
    
    // Return operation status
    const response = {
      operationId,
      status: operation.status,
      startTime: operation.startTime,
      duration: {
        milliseconds: duration,
        seconds: durationSeconds,
        minutes: durationMinutes
      },
      result: operation.result || null,
      error: operation.error || null,
      timestamp: new Date().toISOString()
    };
    
    // Log status checks for long operations
    if (durationMinutes > 0 && durationMinutes % 2 === 0) {
      console.log(`🔍 Status check for ${operationId}: ${operation.status} (${durationMinutes}m)`);
    }
    
    // CRITICAL DEBUG: Always log completed operations
    if (operation.status === 'completed') {
      console.log(`✅ RETURNING COMPLETED OPERATION: ${operationId} with result: ${!!operation.result}`);
    }
    
    // Ensure we always return a valid JSON response
    console.log(`✅ Operation status API: Returning status for ${operationId}: ${operation.status}`);
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error checking operation status:', error);
    // Ensure we always return a valid JSON response even in error cases
    return NextResponse.json({ 
      error: 'Failed to check operation status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * DELETE operation (for cleanup)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { operationId } = await params;
    
    if (!operationId) {
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 });
    }
    
    const operation = operationStore.get(operationId);
    
    if (!operation) {
      return NextResponse.json({ 
        error: 'Operation not found',
        operationId
      }, { status: 404 });
    }
    
    operationStore.delete(operationId);
    
    return NextResponse.json({ 
      success: true,
      operationId,
      message: 'Operation deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting operation:', error);
    return NextResponse.json({ 
      error: 'Failed to delete operation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 