import Decimal from "decimal.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ConceptType, PayrollStatus } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

let reporting: typeof import("@/server/reporting");

beforeAll(async () => {
  reporting = await import("@/server/reporting");
});

describe("reporting", () => {
  it("usa la misma separación pagado/pendiente para el total y cada fila", () => {
    const rows = [
      { employeeId: "1", status: PayrollStatus.PAID, netPay: new Decimal("100.10"), totalIncome: new Decimal("120"), totalDeductions: new Decimal("19.90") },
      { employeeId: "2", status: PayrollStatus.FINALIZED, netPay: new Decimal("50.25"), totalIncome: new Decimal("60"), totalDeductions: new Decimal("9.75") },
    ] as Parameters<typeof reporting.summarize>[0];

    expect(reporting.splitReportNet(rows[0])).toEqual({ pagado: "100.10", pendiente: "0.00" });
    expect(reporting.splitReportNet(rows[1])).toEqual({ pagado: "0.00", pendiente: "50.25" });
    expect(reporting.summarize(rows)).toMatchObject({ pagado: "100.10", pendiente: "50.25", neto: "150.35" });
  });

  it("suma conceptos en código", () => {
    expect(reporting.summarizeConcepts([
      { conceptNameSnapshot: "Bono", type: ConceptType.INCOME, totalAmount: new Decimal("10.10") },
      { conceptNameSnapshot: "Bono", type: ConceptType.INCOME, totalAmount: new Decimal("2.20") },
    ])).toEqual([{ conceptNameSnapshot: "Bono", type: ConceptType.INCOME, totalAmount: "12.30" }]);
  });
});
