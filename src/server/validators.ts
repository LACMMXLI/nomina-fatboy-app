import { z } from "zod";

const money = z.coerce.number().finite().min(0, "El importe no puede ser negativo.");
const date = z.coerce.date({ error: "La fecha no es válida." });

export const employeeSchema = z.object({
  employeeNumber: z.string().trim().min(1, "El número es obligatorio."),
  firstName: z.string().trim().min(1, "El nombre es obligatorio."),
  lastName: z.string().trim().min(1, "El apellido es obligatorio."),
  secondLastName: z.string().trim().optional(),
  branchId: z.string().uuid("Selecciona una sucursal."),
  positionId: z.string().uuid("Selecciona un puesto."),
  hireDate: date,
  baseSalary: money,
  baseDays: z.coerce.number().positive("Los días base deben ser mayores a cero."),
  salaryPeriodicity: z.enum(["DAILY", "WEEKLY", "BIWEEKLY"]),
  calculationMode: z.enum(["FIXED", "PRORATED"]),
  paymentMethod: z.enum(["CASH", "TRANSFER", "MIXED", "OTHER"]),
  phone: z.string().trim().optional(),
  email: z.union([z.email("El correo no es válido."), z.literal("")]).optional(),
  notes: z.string().trim().optional(),
});

export const periodSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio."),
    startDate: date,
    endDate: date,
    paymentDate: date,
    periodType: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "CUSTOM"]),
    branchId: z.union([z.string().uuid(), z.literal("")]).optional(),
    notes: z.string().trim().optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "La fecha final no puede ser anterior a la inicial.",
    path: ["endDate"],
  });

export const movementSchema = z.object({
  periodId: z.string().uuid(),
  employeeId: z.string().uuid(),
  conceptCode: z.string().trim().min(2, "Selecciona un tipo de movimiento.").max(40),
  customName: z.string().trim().max(60).optional(),
  amount: z.coerce.number().finite().positive("El importe debe ser mayor a cero."),
  note: z.string().trim().max(200).optional(),
});

export const payrollDraftSchema = z.object({
  payrollId: z.string().uuid().optional(),
  periodId: z.string().uuid(),
  employeeId: z.string().uuid(),
  updatedAt: z.coerce.date().optional(),
  daysWorked: money,
  daysPaid: money,
  absences: money,
  delays: money,
  overtimeHours: money,
  paymentMethod: z.enum(["CASH", "TRANSFER", "MIXED", "OTHER"]),
  generalNotes: z.string().trim().optional(),
  bonus: money.default(0),
  overtimeAmount: money.default(0),
  advance: money.default(0),
  loan: money.default(0),
  consumption: money.default(0),
  otherDeduction: money.default(0),
});
