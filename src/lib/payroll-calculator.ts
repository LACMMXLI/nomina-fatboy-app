import Decimal from "decimal.js";

export interface PayrollLineInput {
  type: "INCOME" | "DEDUCTION";
  quantity?: Decimal.Value;
  unitAmount: Decimal.Value;
}

export interface PayrollCalculationInput {
  baseSalary: Decimal.Value;
  baseDays: Decimal.Value;
  daysPaid: Decimal.Value;
  calculationMode: "FIXED" | "PRORATED";
  lines?: PayrollLineInput[];
}

export interface PayrollCalculation {
  basePay: string;
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
  const baseDays = nonNegative(input.baseDays, "Los días base");
  const daysPaid = nonNegative(input.daysPaid, "Los días pagados");
  if (input.calculationMode === "PRORATED" && baseDays.isZero()) {
    throw new Error("Los días base deben ser mayores a cero para prorratear.");
  }

  const basePay =
    input.calculationMode === "PRORATED"
      ? salary.div(baseDays).mul(daysPaid).toDecimalPlaces(2)
      : salary.toDecimalPlaces(2);
  let income = basePay;
  let deductions = new Decimal(0);
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
    basePay: basePay.toFixed(2),
    totalIncome: income.toFixed(2),
    totalDeductions: deductions.toFixed(2),
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
