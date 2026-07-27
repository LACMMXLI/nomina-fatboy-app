import { describe, expect, it } from "vitest";
import { FolioType } from "@/generated/prisma/client";
import { formatFolio } from "@/lib/folio";
import {
  CALCULATION_MODE_LABELS,
  CONCEPT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PERIODICITY_LABELS,
  PERIOD_TYPE_LABELS,
  PRINT_SIZE_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  paymentMethodLabel,
  roleLabel,
  statusLabel,
} from "@/lib/labels";
import { canManageUser, hasPermission } from "@/lib/permissions";
import { canSeeSalary, redactSalary } from "@/lib/salary-visibility";
import { periodSchema } from "@/server/validators";

describe("permisos", () => {
  it("impide que encargado finalice o cancele", () => {
    expect(hasPermission("ENCARGADO", "payroll:draft")).toBe(true);
    expect(hasPermission("ENCARGADO", "payroll:finalize")).toBe(false);
    expect(hasPermission("ENCARGADO", "payroll:cancel")).toBe(false);
  });

  it("reserva usuarios y auditoría al super admin", () => {
    expect(hasPermission("SUPER_ADMIN", "users:manage")).toBe(true);
    expect(hasPermission("ADMINISTRADOR", "users:manage")).toBe(false);
    expect(hasPermission("CONSULTA", "audit:view")).toBe(false);
  });

  it("permite editar el perfil propio y reserva otros usuarios al super admin", () => {
    expect(canManageUser("CONSULTA", "u1", "u1")).toBe(true);
    expect(canManageUser("ADMINISTRADOR", "u1", "u2")).toBe(false);
    expect(canManageUser("SUPER_ADMIN", "u1", "u2")).toBe(true);
  });

  it("reserva los sueldos a administradores", () => {
    expect(canSeeSalary("SUPER_ADMIN")).toBe(true);
    expect(canSeeSalary("ADMINISTRADOR")).toBe(true);
    expect(canSeeSalary("ENCARGADO")).toBe(false);
    expect(canSeeSalary("CONSULTA")).toBe(false);
  });

  it("el encargado conserva la captura aunque no vea sueldos", () => {
    expect(hasPermission("ENCARGADO", "payroll:draft")).toBe(true);
    // Puede reimprimir recibos: el PDF exige `reports:view`, no `salary:view`.
    expect(hasPermission("ENCARGADO", "reports:view")).toBe(true);
    expect(hasPermission("ENCARGADO", "exports:create")).toBe(false);
  });
});

describe("censura de sueldos", () => {
  const totals = {
    basePay: "3500.00",
    totalIncome: "4000.00",
    netPay: "3100.00",
    totalDeductions: "900.00",
  };

  it("deja intactos los importes de un administrador", () => {
    expect(redactSalary(totals, true)).toEqual(totals);
  });

  it("borra sueldo, ingresos y neto de quien no puede verlos", () => {
    const hidden = redactSalary(totals, false);
    expect(hidden.basePay).toBeNull();
    expect(hidden.totalIncome).toBeNull();
    expect(hidden.netPay).toBeNull();
  });

  it("conserva los descuentos que el propio encargado captura", () => {
    expect(redactSalary(totals, false).totalDeductions).toBe("900.00");
  });

  it("no deja rastro del sueldo en lo que se envía al navegador", () => {
    const payload = JSON.stringify(redactSalary(totals, false));
    expect(payload).not.toContain("3500");
    expect(payload).not.toContain("4000");
    expect(payload).not.toContain("3100");
  });

  it("conserva campos ajenos al sueldo", () => {
    const withExtras = { ...totals, payrollId: "abc", items: [{ amount: "500.00" }] };
    const hidden = redactSalary(withExtras, false);
    expect(hidden.payrollId).toBe("abc");
    expect(hidden.items).toEqual([{ amount: "500.00" }]);
  });
});

describe("todo en español", () => {
  // Copiados de prisma/schema.prisma. Si allí se agrega un valor, esta prueba
  // falla hasta que exista su traducción en src/lib/labels.ts.
  const enums: Array<[string, Record<string, string>, string[]]> = [
    ["PayrollStatus", STATUS_LABELS, ["DRAFT", "IN_REVIEW", "FINALIZED", "PAID", "CANCELLED", "REPLACED"]],
    ["PeriodStatus", STATUS_LABELS, ["DRAFT", "OPEN", "IN_REVIEW", "CLOSED", "CANCELLED"]],
    ["Role", ROLE_LABELS, ["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO", "CONSULTA"]],
    ["PaymentMethod", PAYMENT_METHOD_LABELS, ["CASH", "TRANSFER", "MIXED", "OTHER"]],
    ["SalaryPeriodicity", PERIODICITY_LABELS, ["DAILY", "WEEKLY", "BIWEEKLY"]],
    ["PeriodType", PERIOD_TYPE_LABELS, ["DAILY", "WEEKLY", "BIWEEKLY", "CUSTOM"]],
    ["CalculationMode", CALCULATION_MODE_LABELS, ["FIXED", "PRORATED"]],
    ["ConceptType", CONCEPT_TYPE_LABELS, ["INCOME", "DEDUCTION"]],
    ["PrintSize", PRINT_SIZE_LABELS, ["MM58", "MM80", "LETTER", "HALF_LETTER"]],
  ];

  it.each(enums)("traduce todos los valores de %s", (_name, dictionary, values) => {
    for (const value of values) {
      expect(dictionary[value], `falta la traducción de ${value}`).toBeTruthy();
    }
  });

  it("no deja códigos en inglés a la vista", () => {
    expect(statusLabel("IN_REVIEW")).toBe("En revisión");
    expect(statusLabel("PAID")).toBe("Pagado");
    expect(roleLabel("SUPER_ADMIN")).toBe("Administrador general");
    expect(paymentMethodLabel("CASH")).toBe("Efectivo");
  });

  it("degrada de forma legible si aparece un valor sin traducir", () => {
    // Nunca debe verse "SOME_NEW_STATE" tal cual en pantalla.
    expect(statusLabel("SOME_NEW_STATE")).toBe("Some new state");
    expect(statusLabel(null)).toBe("—");
  });
});

describe("periodos y folios", () => {
  it("rechaza fecha final anterior", () => {
    expect(periodSchema.safeParse({
      name: "Semana 1",
      startDate: "2026-07-20",
      endDate: "2026-07-19",
      paymentDate: "2026-07-24",
      periodType: "WEEKLY",
    }).success).toBe(false);
  });

  it("formatea folios legibles", () => {
    expect(formatFolio(FolioType.PERIOD, 2026, 12)).toBe("PER-2026-000012");
    expect(formatFolio(FolioType.PAYROLL, 2026, 1)).toBe("NOM-2026-000001");
    expect(formatFolio(FolioType.RECEIPT, 2026, 999999)).toBe("REC-2026-999999");
  });
});
