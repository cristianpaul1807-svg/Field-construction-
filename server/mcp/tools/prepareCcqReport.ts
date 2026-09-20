// server/mcp/tools/prepareCcqReport.ts

import { authorizeOrThrow, UserRole } from '../roles.js';
import { updateActionState, getActionLog } from '../stateMachine.js';
// En una implementación real, importaríamos las funciones de CCQ y Supabase
// import { armarLineas, rangoDelMes } from '../../ccq.js';
// import { generatePdfFromLines } from '../../documents.js';

export interface PrepareCcqInput {
  userId: string;
  role: UserRole;
  month: string; // Formato YYYY-MM
}

/**
 * Función MCP: prepare_ccq_monthly_report
 * Objetivo: Preparar el documento borrador mensual de la CCQ.
 */
export async function prepareCcqReport(input: PrepareCcqInput) {
  // 1. Autorización: Nivel 2 (Preparación)
  authorizeOrThrow(input.role, 2);
  
  // 2. Registrar el inicio de la acción
  const actionId = `ccq_${Date.now()}`;
  updateActionState(actionId, {
    userId: input.userId,
    actionName: 'prepare_ccq_monthly_report',
    state: 'requested'
  });

  try {
    // Simulamos validación de datos
    updateActionState(actionId, { state: 'validated' });
    
    // Al ser Nivel 2 (Borrador Interno), puede pasar directamente a 'running' o solicitar confirmación si así se decide
    updateActionState(actionId, { state: 'running' });

    // Simulamos lógica de negocio:
    // a) Obtener horas del mes
    // b) Obtener datos CCQ de trabajadores
    // c) Detectar datos incompletos
    // d) Generar borrador PDF
    
    // --- LÓGICA SIMULADA ---
    const trabajadoresLeidos = ['user_1', 'user_2'];
    const resumen = `El borrador está listo. Incluye 2 trabajadores, 426 horas y 0 incidencias pendientes. Debes revisarlo y presentarlo manualmente en el portal oficial de la CCQ.`;
    const docUrl = `/api/downloads/ccq_${input.month}_draft.pdf`;

    // 3. Completar acción
    const log = updateActionState(actionId, {
      state: 'completed',
      dataRead: trabajadoresLeidos,
      documentsGenerated: [docUrl],
      resultSummary: resumen
    });

    return {
      success: true,
      actionId: log.id,
      state: log.state,
      downloadUrl: docUrl,
      message: resumen,
      disclaimer: 'El documento está preparado como borrador. Debes revisarlo y transcribirlo o cargarlo en el portal oficial de la CCQ. Logiciel Construction no ha presentado la declaración.'
    };
  } catch (error) {
    // 4. Manejo de error
    updateActionState(actionId, {
      state: 'failed',
      resultSummary: error instanceof Error ? error.message : 'Error desconocido'
    });
    throw error;
  }
}
