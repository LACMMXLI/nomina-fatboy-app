import { z } from "zod";

const receiptItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.enum(["INCOME", "DEDUCTION"]),
  quantity: z.string(),
  unitAmount: z.string(),
  totalAmount: z.string(),
  notes: z.string().nullable(),
});

export const receiptSnapshotSchema = z.object({
  receiptNumber: z.string(),
  payrollFolio: z.string(),
  version: z.number(),
  employeeNumber: z.string(),
  employeeName: z.string(),
  positionName: z.string(),
  branchName: z.string(),
  periodName: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  paymentMethod: z.string(),
  baseSalary: z.string(),
  totalIncome: z.string(),
  totalDeductions: z.string(),
  netPay: z.string(),
  pendingBalance: z.string(),
  notes: z.string().nullable(),
  status: z.string(),
  generatedAt: z.string(),
  generatedBy: z.string(),
  items: z.array(receiptItemSchema),
  settings: z.object({
    businessName: z.string(),
    logoUrl: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    legalLegend: z.string(),
    receiptFooter: z.string().nullable(),
    showEmployeeSignature: z.boolean(),
    showManagerSignature: z.boolean(),
    showQr: z.boolean(),
    showZeroConcepts: z.boolean(),
  }),
});

export type ReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>;
