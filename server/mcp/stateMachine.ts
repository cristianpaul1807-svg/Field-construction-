// server/mcp/stateMachine.ts

export type McpActionState = 
  | 'requested'
  | 'validated'
  | 'awaiting_confirmation'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partially_completed'
  | 'cancelled'
  | 'exported'
  | 'submitted_externally_by_user';

export interface McpActionLog {
  id: string;
  userId: string;
  actionName: string;
  state: McpActionState;
  dataRead: string[];
  dataModified: string[];
  documentsGenerated: string[];
  resultSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

// En una implementación real, esto se guardaría en la base de datos (ej. Supabase)
const actionLogs: Map<string, McpActionLog> = new Map();

/**
 * Registra o actualiza el estado de una acción MCP
 */
export function updateActionState(
  id: string,
  updates: Partial<Omit<McpActionLog, 'id' | 'createdAt'>> & { state: McpActionState }
): McpActionLog {
  const existing = actionLogs.get(id);

  if (existing) {
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    actionLogs.set(id, updated);
    return updated;
  }

  // Crear nueva entrada
  const newAction: McpActionLog = {
    id,
    userId: updates.userId || 'system',
    actionName: updates.actionName || 'unknown',
    state: updates.state,
    dataRead: updates.dataRead || [],
    dataModified: updates.dataModified || [],
    documentsGenerated: updates.documentsGenerated || [],
    resultSummary: updates.resultSummary,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  actionLogs.set(id, newAction);
  return newAction;
}

export function getActionLog(id: string): McpActionLog | undefined {
  return actionLogs.get(id);
}
