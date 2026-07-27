import "server-only";
import Decimal from "decimal.js";
import { ConceptType, PayrollStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { branchAndFilters, type CurrentUser } from "@/server/auth";

/**
 * Capa única de reportes.
 *
 * Todas las pantallas que muestren dinero (inicio, periodos, historial,
 * sucursales, reportes y Excel) deben pedir sus filas con `reportWhere` y
 * sumarlas con `summarize`. Así ningún reporte puede inventarse su propio
 * criterio y mostrar un total distinto del de al lado.
 */

/** Dinero efectivamente entregado. */
export const PAID_STATUSES: PayrollStatus[] = [PayrollStatus.PAID];

/** Nómina cerrada y aún sin pagar. */
export const PENDING_STATUSES: PayrollStatus[] = [PayrollStatus.FINALIZED];

/**
 * Únicos estados que suman. DRAFT e IN_REVIEW son capturas en curso;
 * CANCELLED y REPLACED no cuentan nunca.
 */
export const COUNTED_STATUSES: PayrollStatus[] = [PayrollStatus.PAID, PayrollStatus.FINALIZED];

export interface ReportScope {
  /** Sucursal solicitada. Se valida contra las asignadas al usuario. */
  branchId?: string | null;
  periodId?: string;
  /** Filtros adicionales del reporte (búsqueda, estado elegido, fechas…). */
  extra?: Prisma.PayrollWhereInput;
}

/**
 * Condición base de todo reporte financiero. Combina con `AND`:
 * el alcance de sucursales del usuario, los estados contables y la exclusión
 * de nóminas ya reemplazadas. Nada de esto puede sustituirse desde fuera:
 * `extra` solo puede restringir más.
 */
export function reportWhere(user: CurrentUser, scope: ReportScope = {}): Prisma.PayrollWhereInput {
  return {
    AND: [
      ...branchAndFilters(user, scope.branchId),
      { status: { in: COUNTED_STATUSES } },
      { replacementPayroll: { is: null } },
      ...(scope.periodId ? [{ periodId: scope.periodId }] : []),
      ...(scope.extra ? [scope.extra] : []),
    ],
  };
}

/** Campos mínimos para sumar. Los reportes que necesiten más, amplían el select. */
export const reportRowSelect = {
  id: true,
  employeeId: true,
  branchId: true,
  periodId: true,
  status: true,
  netPay: true,
  totalIncome: true,
  totalDeductions: true,
} satisfies Prisma.PayrollSelect;

export type ReportRow = Prisma.PayrollGetPayload<{ select: typeof reportRowSelect }>;

export function loadReportRows(user: CurrentUser, scope: ReportScope = {}) {
  return db.payroll.findMany({ where: reportWhere(user, scope), select: reportRowSelect });
}

export interface ReportTotals {
  /** Suma de las nóminas en estado PAID. */
  pagado: string;
  /** Suma de las nóminas FINALIZED aún sin pagar. */
  pendiente: string;
  /** pagado + pendiente. */
  neto: string;
  ingresos: string;
  descuentos: string;
  nominas: number;
  empleados: number;
}

type SummarizableRow = Pick<ReportRow, "employeeId" | "status" | "netPay" | "totalIncome" | "totalDeductions">;

/** Separa el neto con exactamente la misma regla para pantallas y Excel. */
export function splitReportNet(row: Pick<ReportRow, "status" | "netPay">) {
  const net = new Decimal(row.netPay.toString());
  return {
    pagado: PAID_STATUSES.includes(row.status) ? net.toFixed(2) : "0.00",
    pendiente: PENDING_STATUSES.includes(row.status) ? net.toFixed(2) : "0.00",
  };
}

/** Totales de un conjunto de filas ya filtrado con `reportWhere`. */
export function summarize(rows: SummarizableRow[]): ReportTotals {
  let pagado = new Decimal(0);
  let pendiente = new Decimal(0);
  let ingresos = new Decimal(0);
  let descuentos = new Decimal(0);
  const empleados = new Set<string>();
  for (const row of rows) {
    const net = splitReportNet(row);
    pagado = pagado.add(net.pagado);
    pendiente = pendiente.add(net.pendiente);
    ingresos = ingresos.add(row.totalIncome.toString());
    descuentos = descuentos.add(row.totalDeductions.toString());
    empleados.add(row.employeeId);
  }
  return {
    pagado: pagado.toFixed(2),
    pendiente: pendiente.toFixed(2),
    neto: pagado.add(pendiente).toFixed(2),
    ingresos: ingresos.toFixed(2),
    descuentos: descuentos.toFixed(2),
    nominas: rows.length,
    empleados: empleados.size,
  };
}

type SummarizableConcept = {
  conceptNameSnapshot: string;
  type: ConceptType;
  totalAmount: { toString(): string };
};

/** Desglose por concepto calculado en código, sin groupBy/_sum financiero. */
export function summarizeConcepts(items: SummarizableConcept[], take = 15) {
  const totals = new Map<string, { conceptNameSnapshot: string; type: ConceptType; totalAmount: Decimal }>();
  for (const item of items) {
    const key = JSON.stringify([item.type, item.conceptNameSnapshot]);
    const current = totals.get(key);
    totals.set(key, {
      conceptNameSnapshot: item.conceptNameSnapshot,
      type: item.type,
      totalAmount: (current?.totalAmount ?? new Decimal(0)).add(item.totalAmount.toString()),
    });
  }
  return [...totals.values()]
    .sort((a, b) => b.totalAmount.comparedTo(a.totalAmount))
    .slice(0, take)
    .map((item) => ({ ...item, totalAmount: item.totalAmount.toFixed(2) }));
}

/** Agrupa y resume por una clave de la fila (sucursal, periodo…). */
export function summarizeBy<Row extends SummarizableRow>(
  rows: Row[],
  key: (row: Row) => string | null,
): Map<string, ReportTotals> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const bucket = grouped.get(id);
    if (bucket) bucket.push(row);
    else grouped.set(id, [row]);
  }
  return new Map([...grouped].map(([id, group]) => [id, summarize(group)]));
}

/** Totales en cero, para claves sin ninguna nómina contable. */
export const EMPTY_TOTALS: ReportTotals = {
  pagado: "0.00",
  pendiente: "0.00",
  neto: "0.00",
  ingresos: "0.00",
  descuentos: "0.00",
  nominas: 0,
  empleados: 0,
};
