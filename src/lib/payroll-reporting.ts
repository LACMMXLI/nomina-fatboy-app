import { PayrollStatus, Prisma } from "@/generated/prisma/client";

/** Dinero efectivamente entregado. */
export const PAID_STATUSES: PayrollStatus[] = [PayrollStatus.PAID];

/** Nómina cerrada y aún sin pagar. */
export const PENDING_STATUSES: PayrollStatus[] = [PayrollStatus.FINALIZED];

/**
 * Únicos estados que suman en un reporte financiero.
 * DRAFT e IN_REVIEW son capturas en curso; CANCELLED y REPLACED nunca cuentan.
 */
export const COUNTED_STATUSES: PayrollStatus[] = [PayrollStatus.PAID, PayrollStatus.FINALIZED];

/**
 * Condición base de todo reporte: estado contable y última versión.
 * `replacementPayroll: null` descarta cualquier fila que ya fue sustituida por
 * otra versión, aunque su estado no se hubiera actualizado.
 */
export const countableWhere = {
  status: { in: COUNTED_STATUSES },
  replacementPayroll: { is: null },
} satisfies Prisma.PayrollWhereInput;

export const paidWhere = {
  status: { in: PAID_STATUSES },
  replacementPayroll: { is: null },
} satisfies Prisma.PayrollWhereInput;

export const pendingWhere = {
  status: { in: PENDING_STATUSES },
  replacementPayroll: { is: null },
} satisfies Prisma.PayrollWhereInput;

/** Suma neta de las nóminas cuyo estado esté en `statuses`. */
export function sumNet(
  payrolls: Array<{ netPay: { toString(): string }; status: PayrollStatus }>,
  statuses: PayrollStatus[],
) {
  return payrolls
    .filter((payroll) => statuses.includes(payroll.status))
    .reduce((total, payroll) => total + Number(payroll.netPay), 0);
}

/** Empleados distintos con al menos una nómina contable. */
export function uniqueEmployees(payrolls: Array<{ employeeId: string }>) {
  return new Set(payrolls.map((payroll) => payroll.employeeId)).size;
}
