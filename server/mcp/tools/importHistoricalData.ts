// server/mcp/tools/importHistoricalData.ts

import { authorizeOrThrow, UserRole } from '../roles.js';
import { updateActionState, getActionLog } from '../stateMachine.js';

export interface ImportDataInput {
  userId: string;
  role: UserRole;
  dataType: 'clientes' | 'trabajadores' | 'proyectos';
  rawData: string;
  confirm?: boolean; // El usuario debe confirmar en la segunda pasada
  actionId?: string; // ID de la acción a confirmar
}

/**
 * Función MCP: import_historical_data
 * Objetivo: Importar datos históricos desde un sistema antiguo o documentos, 
 * con revisión previa requerida.
 */
export async function importHistoricalData(input: ImportDataInput) {
  // 1. Autorización: El rol admin tiene acceso total (equivale al dueño).
  if (input.role !== 'admin') {
    throw new Error('Acceso denegado: solo los administradores pueden importar datos históricos de onboarding.');
  }
  
  // Requerimos Nivel 3 (Modificación Interna)
  authorizeOrThrow(input.role, 3);

  // Si es la fase de confirmación
  if (input.confirm && input.actionId) {
    const log = getActionLog(input.actionId);
    if (!log || log.state !== 'awaiting_confirmation') {
      throw new Error('Acción no encontrada o no está pendiente de confirmación.');
    }
    
    // Ejecutar la inserción en base de datos real aquí...
    
    const finalLog = updateActionState(input.actionId, {
      state: 'completed',
      resultSummary: `Se han importado los datos de ${input.dataType} exitosamente.`
    });

    return {
      success: true,
      actionId: finalLog.id,
      state: finalLog.state,
      message: finalLog.resultSummary
    };
  }

  // --- Fase 1: Análisis y Preparación (No insertar aún) ---
  const actionId = `import_${Date.now()}`;
  updateActionState(actionId, {
    userId: input.userId,
    actionName: 'import_historical_data',
    state: 'requested'
  });

  try {
    updateActionState(actionId, { state: 'validated' });

    // Simulamos el "razonamiento" o mapeo de datos
    // En una implementación real, Claude o el backend procesaría `input.rawData`
    // para mapearlo al esquema de la DB.
    const registrosDetectados = 5; 
    
    const resumen = `He analizado la información. Se detectaron ${registrosDetectados} registros de tipo '${input.dataType}' válidos para importar en Logiciel Construction. ¿Deseas que proceda con la importación?`;

    // Pasamos a 'awaiting_confirmation' para obligar a la revisión humana
    const log = updateActionState(actionId, {
      state: 'awaiting_confirmation',
      dataRead: [input.rawData.substring(0, 50) + '...'], // Auditoría simple
      resultSummary: resumen
    });

    return {
      success: true,
      actionId: log.id,
      state: log.state,
      message: resumen,
      requiresConfirmation: true
    };
  } catch (error) {
    updateActionState(actionId, {
      state: 'failed',
      resultSummary: error instanceof Error ? error.message : 'Error desconocido en importación'
    });
    throw error;
  }
}
