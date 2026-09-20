// server/mcp/roles.ts

export type UserRole = 'admin' | 'financial' | 'site_manager' | 'worker';

export type ActionLevel = 1 | 2 | 3 | 4;

const RoleActionMap: Record<UserRole, ActionLevel[]> = {
  // Administrador o propietario principal
  'admin': [1, 2, 3], // En una fase posterior podría tener 4 con pantalla de confirmación externa
  // Financiero o contabilidad
  'financial': [1, 2, 3], // Acceso a preparación y sincronización financiera
  // Jefe de obra
  'site_manager': [1, 2, 3], // Principalmente operativo, modificaciones operativas
  // Trabajador de campo y subcontratista
  'worker': [1], // Consulta y captura limitada
};

export function canExecuteAction(role: UserRole, level: ActionLevel): boolean {
  const allowedLevels = RoleActionMap[role];
  return allowedLevels.includes(level);
}

export function authorizeOrThrow(role: UserRole, level: ActionLevel) {
  if (!canExecuteAction(role, level)) {
    throw new Error(`Acceso denegado: el rol ${role} no tiene permisos para acciones de nivel ${level}.`);
  }
}
