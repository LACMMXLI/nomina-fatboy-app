import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

/**
 * Importes de un borrador. Los campos sensibles son `string | null`:
 * `null` significa que el rol no puede verlos y el dato nunca salió del servidor.
 */
export interface SalaryTotals {
  basePay: string | null;
  totalIncome: string | null;
  netPay: string | null;
  /** Suma de los movimientos capturados; no depende de `salary:view`. */
  totalDeductions: string;
}

export function canSeeSalary(role: Role) {
  return hasPermission(role, "salary:view");
}

/**
 * Quita sueldo base, ingresos y neto cuando el rol no tiene `salary:view`.
 * Conserva los descuentos: son los movimientos que el propio encargado captura,
 * y ocultarlos le impediría hacer su trabajo sin proteger nada (los acaba de teclear).
 */
export function redactSalary<T extends SalaryTotals>(totals: T, visible: boolean): T {
  if (visible) return totals;
  return { ...totals, basePay: null, totalIncome: null, netPay: null };
}
