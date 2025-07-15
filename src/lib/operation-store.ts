/**
 * CENTRALIZED OPERATION STORE
 * Prevents module loading race conditions by providing a single source of truth
 * for operation state across all API routes
 */

interface OperationState {
  status: 'pending' | 'completed' | 'error';
  startTime: number;
  result?: any;
  error?: string;
}

class OperationStore {
  private store: Map<string, OperationState> = new Map();
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  constructor() {
    // Set up periodic cleanup of old operations
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  set(operationId: string, state: OperationState): void {
    console.log(`🔄 OperationStore: Setting ${operationId} with status ${state.status}`);
    this.store.set(operationId, state);
    console.log(`📊 OperationStore: Total operations: ${this.store.size}`);
  }

  get(operationId: string): OperationState | undefined {
    const operation = this.store.get(operationId);
    console.log(`🔍 OperationStore: Getting ${operationId} - ${operation ? 'FOUND' : 'NOT FOUND'}`);
    if (!operation) {
      console.log(`📊 OperationStore: Available operations: ${Array.from(this.store.keys()).join(', ')}`);
    }
    return operation;
  }

  delete(operationId: string): boolean {
    console.log(`🗑️ OperationStore: Deleting ${operationId}`);
    return this.store.delete(operationId);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  size(): number {
    return this.store.size;
  }

  private cleanup(): void {
    const oneHourAgo = Date.now() - this.CLEANUP_INTERVAL;
    let cleaned = 0;
    
    for (const [operationId, state] of this.store.entries()) {
      if (state.startTime < oneHourAgo && state.status !== 'pending') {
        this.store.delete(operationId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 OperationStore: Cleaned up ${cleaned} old operations`);
    }
  }
}

// Export a singleton instance to ensure all API routes use the same store
export const operationStore = new OperationStore(); 