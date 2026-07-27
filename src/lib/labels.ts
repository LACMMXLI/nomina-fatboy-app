/**
 * Traducciones al español de los valores que la base de datos guarda en inglés.
 *
 * Los enums de Prisma y las acciones de auditoría son identificadores internos:
 * viajan en inglés por compatibilidad, pero NUNCA deben llegar así a la pantalla.
 * Cualquier valor nuevo que se muestre al usuario se agrega aquí.
 */

/** Estados de nómina y de periodo. En masculino, porque acompañan a «estado». */
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  OPEN: "Abierto",
  IN_REVIEW: "En revisión",
  CLOSED: "Cerrado",
  FINALIZED: "Finalizado",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
  REPLACED: "Reemplazado",
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Administrador general",
  ADMINISTRADOR: "Administrador",
  ENCARGADO: "Encargado",
  CONSULTA: "Consulta",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  MIXED: "Mixto",
  OTHER: "Otro",
};

export const PERIODICITY_LABELS: Record<string, string> = {
  DAILY: "Diario",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
};

export const PERIOD_TYPE_LABELS: Record<string, string> = {
  ...PERIODICITY_LABELS,
  CUSTOM: "Personalizado",
};

export const CALCULATION_MODE_LABELS: Record<string, string> = {
  FIXED: "Sueldo fijo",
  PRORATED: "Proporcional a los días",
};

export const CONCEPT_TYPE_LABELS: Record<string, string> = {
  INCOME: "Ingreso",
  DEDUCTION: "Descuento",
};

export const PRINT_SIZE_LABELS: Record<string, string> = {
  MM58: "Ticket de 58 mm",
  MM80: "Ticket de 80 mm",
  LETTER: "Hoja carta",
  HALF_LETTER: "Media carta",
};

/** Acciones registradas en la bitácora de auditoría. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE_EMPLOYEE: "Alta de empleado",
  CHANGE_EMPLOYEE_SALARY: "Cambio de sueldo",
  DEACTIVATE_EMPLOYEE: "Baja de empleado",
  REACTIVATE_EMPLOYEE: "Reactivación de empleado",
  CREATE_PERIOD: "Creación de periodo",
  CREATE_PAYROLL_DRAFT: "Creación de borrador",
  UPDATE_PAYROLL_DRAFT: "Edición de borrador",
  ADD_MOVEMENT: "Alta de movimiento",
  REMOVE_MOVEMENT: "Baja de movimiento",
  FINALIZE_PAYROLL: "Nómina finalizada",
  PAY_PAYROLL: "Pago registrado",
  CANCEL_PAYROLL: "Nómina cancelada",
  REPLACE_PAYROLL: "Nómina reemplazada",
  CREATE_BRANCH: "Alta de sucursal",
  CREATE_USER: "Alta de usuario",
  UPDATE_USER: "Edición de usuario",
  CHANGE_USER_PASSWORD: "Cambio de contraseña",
  UPDATE_SETTINGS: "Cambio de configuración",
  EXPORT_EXCEL: "Exportación a Excel",
};

/** Entidades sobre las que actúa la auditoría. */
export const ENTITY_LABELS: Record<string, string> = {
  Employee: "Empleado",
  PayrollPeriod: "Periodo",
  Payroll: "Nómina",
  Branch: "Sucursal",
  User: "Usuario",
  SystemSettings: "Configuración",
  Report: "Reporte",
};

export const AUDIT_RESULT_LABELS: Record<string, string> = {
  SUCCESS: "Correcto",
  FAILURE: "Fallido",
  DENIED: "Denegado",
};

/**
 * Traduce un valor. Si aparece uno sin traducción (por ejemplo, un enum nuevo),
 * se muestra legible en vez de romper: `IN_REVIEW` → `In review`.
 */
function translate(dictionary: Record<string, string>, value: string | null | undefined) {
  if (!value) return "—";
  const label = dictionary[value];
  if (label) return label;
  const readable = value.replaceAll("_", " ").toLowerCase();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export const statusLabel = (value: string | null | undefined) => translate(STATUS_LABELS, value);
export const roleLabel = (value: string | null | undefined) => translate(ROLE_LABELS, value);
export const paymentMethodLabel = (value: string | null | undefined) => translate(PAYMENT_METHOD_LABELS, value);
export const periodicityLabel = (value: string | null | undefined) => translate(PERIODICITY_LABELS, value);
export const periodTypeLabel = (value: string | null | undefined) => translate(PERIOD_TYPE_LABELS, value);
export const calculationModeLabel = (value: string | null | undefined) => translate(CALCULATION_MODE_LABELS, value);
export const conceptTypeLabel = (value: string | null | undefined) => translate(CONCEPT_TYPE_LABELS, value);
export const printSizeLabel = (value: string | null | undefined) => translate(PRINT_SIZE_LABELS, value);
export const auditActionLabel = (value: string | null | undefined) => translate(AUDIT_ACTION_LABELS, value);
export const entityLabel = (value: string | null | undefined) => translate(ENTITY_LABELS, value);
export const auditResultLabel = (value: string | null | undefined) => translate(AUDIT_RESULT_LABELS, value);
