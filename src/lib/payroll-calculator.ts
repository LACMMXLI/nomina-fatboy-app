import Decimal from "decimal.js";

export interface PayrollLineInput {
  type: "INCOME" | "DEDUCTION";
  quantity?: Decimal.Value;
  unitAmount: Decimal.Value;
}

export type SalaryPeriodicity = "DAILY" | "WEEKLY" | "BIWEEKLY";

/**
 * Días que cubre el sueldo base según su periodicidad.
 * Sirven de respaldo cuando el empleado no tiene `baseDays` configurado.
 */
export const PERIODICITY_DAYS: Record<SalaryPeriodicity, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 15,
};

export interface PayrollCalculationInput {
  baseSalary: Decimal.Value;
  baseDays: Decimal.Value;
  daysPaid: Decimal.Value;
  calculationMode: "FIXED" | "PRORATED";
  /** Periodicidad del sueldo base. Si se omite se asume semanal. */
  salaryPeriodicity?: SalaryPeriodicity;
  /**
   * Faltas a descontar al valor del día. Solo se aplica si se envía;
   * si las faltas ya vienen como concepto en `lines`, se omite para no
   * descontarlas dos veces.
   */
  absences?: Decimal.Value;
  /** Horas extra trabajadas. Requiere `overtimeRate` para pagarse. */
  overtimeHours?: Decimal.Value;
  /** Importe por hora extra. Sin él, las horas no generan pago. */
  overtimeRate?: Decimal.Value | null;
  lines?: PayrollLineInput[];
}

export interface PayrollCalculation {
  /** Valor de un día de trabajo: base entre los días que cubre el sueldo. */
  dailyRate: string;
  basePay: string;
  /** Descuento generado por las faltas enviadas en `absences`. */
  absenceDeduction: string;
  /** Pago generado por `overtimeHours` × `overtimeRate`. */
  overtimePay: string;
  totalIncome: string;
  totalDeductions: string;
  netPay: string;
  pendingBalance: string;
  lineTotals: string[];
}

function nonNegative(value: Decimal.Value, label: string) {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.isNegative()) {
    throw new Error(`${label} debe ser un número mayor o igual a cero.`);
  }
  return decimal;
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculation {
  const salary = nonNegative(input.baseSalary, "El sueldo base");
  const daysPaid = nonNegative(input.daysPaid, "Los días pagados");
  const periodicity = input.salaryPeriodicity ?? "WEEKLY";

  // Los días que cubre el sueldo: los del empleado o, si no están, los de su
  // periodicidad (diario 1, semanal 7, quincenal 15).
  const configuredDays = nonNegative(input.baseDays, "Los días base");
  const baseDays = configuredDays.isZero() ? new Decimal(PERIODICITY_DAYS[periodicity]) : configuredDays;
  if (baseDays.isZero()) {
    throw new Error("Los días base deben ser mayores a cero.");
  }

  // Valor de un día. En periodicidad diaria el sueldo base ya es el día.
  const dailyRate =
    periodicity === "DAILY" ? salary : salary.div(baseDays);

  // PRORATED paga por día trabajado; FIXED paga el sueldo completo del periodo.
  const basePay =
    input.calculationMode === "PRORATED"
      ? dailyRate.mul(daysPaid).toDecimalPlaces(2)
      : salary.toDecimalPlaces(2);

  // Faltas: se descuenta un día por cada una.
  const absences = nonNegative(input.absences ?? 0, "Las faltas");
  const absenceDeduction = dailyRate.mul(absences).toDecimalPlaces(2);

  // Horas extra: solo se pagan si hay tarifa configurada.
  const overtimeHours = nonNegative(input.overtimeHours ?? 0, "Las horas extra");
  const overtimeRate = nonNegative(input.overtimeRate ?? 0, "La tarifa de hora extra");
  const overtimePay = overtimeHours.mul(overtimeRate).toDecimalPlaces(2);

  let income = basePay.add(overtimePay);
  let deductions = absenceDeduction;
  const lineTotals = (input.lines ?? []).map((line) => {
    const quantity = nonNegative(line.quantity ?? 1, "La cantidad");
    const amount = nonNegative(line.unitAmount, "El importe");
    const total = quantity.mul(amount).toDecimalPlaces(2);
    if (line.type === "INCOME") income = income.add(total);
    else deductions = deductions.add(total);
    return total.toFixed(2);
  });
  const net = income.sub(deductions).toDecimalPlaces(2);

  return {
    dailyRate: dailyRate.toDecimalPlaces(2).toFixed(2),
    basePay: basePay.toFixed(2),
    absenceDeduction: absenceDeduction.toFixed(2),
    overtimePay: overtimePay.toFixed(2),
    totalIncome: income.toDecimalPlaces(2).toFixed(2),
    totalDeductions: deductions.toDecimalPlaces(2).toFixed(2),
    netPay: net.toFixed(2),
    pendingBalance: Decimal.max(net.negated(), 0).toFixed(2),
    lineTotals,
  };
}

export function validateMixedPayment(
  netPay: Decimal.Value,
  cash: Decimal.Value,
  transfer: Decimal.Value,
  other: Decimal.Value = 0,
) {
  const expected = nonNegative(netPay, "El total a pagar");
  const actual = nonNegative(cash, "El importe en efectivo")
    .add(nonNegative(transfer, "El importe por transferencia"))
    .add(nonNegative(other, "El otro importe"));
  if (!actual.equals(expected)) throw new Error("La suma de los pagos no coincide con el total.");
  return actual.toFixed(2);
}
