/**
 * Tipos compartidos por el atajo global de captura.
 * Viven fuera de `src/server/actions.ts` porque un módulo `"use server"`
 * solo puede exportar funciones asíncronas.
 */

export interface QuickEmployee {
  id: string;
  name: string;
  number: string;
  position: string;
  branchName: string;
  branchColor: string;
  /** `null` cuando el rol no tiene `salary:view`. */
  baseSalary: string | null;
  periodId: string | null;
  periodName: string | null;
}

export interface QuickConcept {
  code: string;
  name: string;
  type: "INCOME" | "DEDUCTION";
}

export interface QuickCaptureData {
  employees: QuickEmployee[];
  concepts: QuickConcept[];
}

export interface QuickDraftState {
  payrollId: string | null;
  /** `null` cuando el rol no tiene `salary:view`. */
  basePay: string | null;
  totalIncome: string | null;
  netPay: string | null;
  totalDeductions: string;
  status: string | null;
  items: Array<{
    id: string;
    code: string;
    name: string;
    type: "INCOME" | "DEDUCTION";
    amount: string;
    note: string | null;
  }>;
}
