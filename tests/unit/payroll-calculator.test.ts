import { describe, expect, it } from "vitest";
import { calculatePayroll, validateMixedPayment } from "@/lib/payroll-calculator";

describe("calculatePayroll", () => {
  it("calcula modo fijo, ingresos y descuentos", () => {
    expect(calculatePayroll({
      baseSalary: "3500",
      baseDays: 7,
      daysPaid: 5,
      calculationMode: "FIXED",
      lines: [
        { type: "INCOME", unitAmount: 500 },
        { type: "DEDUCTION", unitAmount: 300 },
        { type: "DEDUCTION", quantity: 2, unitAmount: 50 },
      ],
    })).toMatchObject({
      basePay: "3500.00",
      totalIncome: "4000.00",
      totalDeductions: "400.00",
      netPay: "3600.00",
      pendingBalance: "0.00",
    });
  });

  it("prorratea sin usar punto flotante", () => {
    const result = calculatePayroll({
      baseSalary: "1000",
      baseDays: 7,
      daysPaid: 3,
      calculationMode: "PRORATED",
    });
    expect(result.basePay).toBe("428.57");
    expect(result.netPay).toBe("428.57");
  });

  it("acepta nómina en cero", () => {
    expect(calculatePayroll({
      baseSalary: 0,
      baseDays: 7,
      daysPaid: 7,
      calculationMode: "FIXED",
    }).netPay).toBe("0.00");
  });

  it("registra saldo cuando el total es negativo", () => {
    expect(calculatePayroll({
      baseSalary: 100,
      baseDays: 7,
      daysPaid: 7,
      calculationMode: "FIXED",
      lines: [{ type: "DEDUCTION", unitAmount: 180 }],
    })).toMatchObject({ netPay: "-80.00", pendingBalance: "80.00" });
  });

  it("rechaza negativos, infinito y NaN", () => {
    expect(() => calculatePayroll({ baseSalary: -1, baseDays: 7, daysPaid: 7, calculationMode: "FIXED" })).toThrow();
    expect(() => calculatePayroll({ baseSalary: Infinity, baseDays: 7, daysPaid: 7, calculationMode: "FIXED" })).toThrow();
    expect(() => calculatePayroll({ baseSalary: NaN, baseDays: 7, daysPaid: 7, calculationMode: "FIXED" })).toThrow();
  });

  it("valida la suma de un pago mixto", () => {
    expect(validateMixedPayment("1000", "400", "500", "100")).toBe("1000.00");
    expect(() => validateMixedPayment("1000", "400", "500")).toThrow("no coincide");
  });
});
