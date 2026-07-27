import "server-only";
import { randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import Decimal from "decimal.js";
import {
  ConceptType,
  FolioType,
  PayrollStatus,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { calculatePayroll, validateMixedPayment } from "@/lib/payroll-calculator";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { formatFolio } from "@/lib/folio";
import { canSeeSalary, redactSalary } from "@/lib/salary-visibility";
import { ForbiddenError, assertBranchAccess, requireUser } from "@/server/auth";
import type { z } from "zod";
import type { payrollDraftSchema } from "@/server/validators";

type Transaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type DraftInput = z.infer<typeof payrollDraftSchema>;

const editableStatuses: PayrollStatus[] = [PayrollStatus.DRAFT, PayrollStatus.IN_REVIEW];
const cancellableStatuses: PayrollStatus[] = [PayrollStatus.FINALIZED, PayrollStatus.PAID];
const replaceableStatuses: PayrollStatus[] = [
  PayrollStatus.FINALIZED,
  PayrollStatus.PAID,
  PayrollStatus.CANCELLED,
];

export async function nextFolio(tx: Transaction, type: FolioType) {
  const year = new Date().getUTCFullYear();
  const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
    INSERT INTO "FolioCounter" ("year", "type", "value", "updatedAt")
    VALUES (${year}, ${type}::"FolioType", 1, NOW())
    ON CONFLICT ("year", "type")
    DO UPDATE SET "value" = "FolioCounter"."value" + 1, "updatedAt" = NOW()
    RETURNING "value"
  `);
  return formatFolio(type, year, rows[0].value);
}

function draftLines(input: DraftInput) {
  return [
    ["BONUS", ConceptType.INCOME, input.bonus],
    ["OVERTIME", ConceptType.INCOME, input.overtimeAmount],
    ["ADVANCE", ConceptType.DEDUCTION, input.advance],
    ["LOAN", ConceptType.DEDUCTION, input.loan],
    ["CONSUMPTION", ConceptType.DEDUCTION, input.consumption],
    ["OTHER_DEDUCTION", ConceptType.DEDUCTION, input.otherDeduction],
  ] as const;
}

export async function savePayrollDraft(input: DraftInput) {
  const user = await requireUser("payroll:draft");
  const [period, employee] = await Promise.all([
    db.payrollPeriod.findUnique({ where: { id: input.periodId } }),
    db.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, position: true },
    }),
  ]);
  if (!period || !employee) throw new Error("El periodo o empleado no existe.");
  assertBranchAccess(user, employee.branchId);
  assertBranchAccess(user, period.branchId);
  if (!["OPEN", "DRAFT"].includes(period.status)) throw new Error("El periodo no está abierto.");
  if (!employee.isActive) throw new Error("El empleado no está activo.");
  if (period.branchId && period.branchId !== employee.branchId) {
    throw new Error("El empleado no pertenece a la sucursal del periodo.");
  }

  return db.$transaction(async (tx) => {
    // Dentro de la transacción se vuelve a comprobar el vínculo completo
    // (nómina + periodo + empleado + sucursal) por si algo cambió al entrar.
    const current = input.payrollId
      ? await tx.payroll.findFirst({
          where: {
            id: input.payrollId,
            periodId: input.periodId,
            employeeId: input.employeeId,
            branchId: employee.branchId,
          },
        })
      : await tx.payroll.findFirst({
          where: {
            periodId: input.periodId,
            employeeId: input.employeeId,
            branchId: employee.branchId,
            status: { in: [PayrollStatus.DRAFT, PayrollStatus.IN_REVIEW] },
          },
          orderBy: { version: "desc" },
        });
    if (input.payrollId && !current) {
      throw new ForbiddenError("La nómina no corresponde a este empleado y periodo.");
    }
    if (current) {
      assertBranchAccess(user, current.branchId);
      if (!editableStatuses.includes(current.status)) throw new Error("La nómina ya no puede editarse.");
    }

    const baseSalary = current?.baseSalarySnapshot ?? employee.baseSalary;
    const baseDays = current?.baseDaysSnapshot ?? employee.baseDays;
    const calculationMode = current?.calculationModeSnapshot ?? employee.calculationMode;
    const rawLines = draftLines(input).filter(([, , amount]) => new Decimal(amount).greaterThan(0));
    const calculation = calculatePayroll({
      baseSalary: baseSalary.toString(),
      baseDays: baseDays.toString(),
      daysPaid: input.daysPaid,
      calculationMode,
      lines: rawLines.map(([, type, amount]) => ({ type, unitAmount: amount })),
    });
    const concepts = await tx.payrollConcept.findMany({
      where: { code: { in: rawLines.map(([code]) => code) } },
    });
    const byCode = new Map(concepts.map((concept) => [concept.code, concept]));

    let payrollId = current?.id;
    if (current) {
      const updated = await tx.payroll.updateMany({
        where: {
          id: current.id,
          // El vínculo se repite en la escritura: si otro proceso lo alteró,
          // la actualización no encuentra fila y aborta en vez de escribir mal.
          periodId: period.id,
          employeeId: employee.id,
          branchId: employee.branchId,
          status: { in: [PayrollStatus.DRAFT, PayrollStatus.IN_REVIEW] },
          ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
        },
        data: {
          daysWorked: input.daysWorked,
          daysPaid: input.daysPaid,
          absences: input.absences,
          delays: input.delays,
          overtimeHours: input.overtimeHours,
          paymentMethod: input.paymentMethod,
          generalNotes: input.generalNotes,
          totalIncome: calculation.totalIncome,
          totalDeductions: calculation.totalDeductions,
          netPay: calculation.netPay,
          pendingBalance: calculation.pendingBalance,
          updatedByUserId: user.id,
        },
      });
      if (updated.count === 0) {
        const error = new Error("Esta nómina fue modificada por otro usuario. Recarga la información.");
        Object.assign(error, { conflict: true });
        throw error;
      }
      await tx.payrollItem.deleteMany({ where: { payrollId: current.id } });
    } else {
      const folio = await nextFolio(tx, FolioType.PAYROLL);
      const created = await tx.payroll.create({
        data: {
          folio,
          periodId: period.id,
          employeeId: employee.id,
          branchId: employee.branchId,
          employeeNumberSnapshot: employee.employeeNumber,
          employeeNameSnapshot: fullName(employee),
          positionNameSnapshot: employee.position.name,
          branchNameSnapshot: employee.branch.name,
          periodNameSnapshot: period.name,
          periodStartSnapshot: period.startDate,
          periodEndSnapshot: period.endDate,
          baseSalarySnapshot: baseSalary,
          baseDaysSnapshot: baseDays,
          daysWorked: input.daysWorked,
          daysPaid: input.daysPaid,
          absences: input.absences,
          delays: input.delays,
          overtimeHours: input.overtimeHours,
          calculationModeSnapshot: calculationMode,
          totalIncome: calculation.totalIncome,
          totalDeductions: calculation.totalDeductions,
          netPay: calculation.netPay,
          pendingBalance: calculation.pendingBalance,
          paymentMethod: input.paymentMethod,
          generalNotes: input.generalNotes,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      payrollId = created.id;
    }

    if (rawLines.length) {
      await tx.payrollItem.createMany({
        data: rawLines.map(([code, type, amount], index) => {
          const concept = byCode.get(code);
          if (!concept) throw new Error(`No existe el concepto ${code}.`);
          return {
            payrollId: payrollId!,
            conceptId: concept.id,
            conceptCodeSnapshot: concept.code,
            conceptNameSnapshot: concept.name,
            type,
            quantity: 1,
            unitAmount: amount,
            totalAmount: amount,
            displayOrder: index,
          };
        }),
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: current ? "UPDATE_PAYROLL_DRAFT" : "CREATE_PAYROLL_DRAFT",
        entityType: "Payroll",
        entityId: payrollId,
        branchId: employee.branchId,
        newValues: {
          totalIncome: calculation.totalIncome,
          totalDeductions: calculation.totalDeductions,
          netPay: calculation.netPay,
        },
      },
    });
    return tx.payroll.findUniqueOrThrow({ where: { id: payrollId }, include: { items: true } });
  });
}

export interface MovementInput {
  periodId: string;
  employeeId: string;
  conceptCode: string;
  customName?: string;
  amount: string;
  note?: string;
}

export interface DraftMovement {
  id: string;
  code: string;
  name: string;
  type: ConceptType;
  amount: string;
  note: string | null;
}

export interface DraftState {
  payrollId: string | null;
  /** `null` cuando el rol no tiene `salary:view`: el importe no sale del servidor. */
  basePay: string | null;
  totalIncome: string | null;
  netPay: string | null;
  /** Suma de los movimientos capturados; visible para todos los roles. */
  totalDeductions: string;
  status: PayrollStatus | null;
  items: DraftMovement[];
}


function toMovements(items: Array<{ id: string; conceptCodeSnapshot: string; conceptNameSnapshot: string; type: ConceptType; totalAmount: { toString(): string }; notes: string | null }>): DraftMovement[] {
  return items.map((item) => ({
    id: item.id,
    code: item.conceptCodeSnapshot,
    name: item.conceptNameSnapshot,
    type: item.type,
    amount: item.totalAmount.toString(),
    note: item.notes,
  }));
}

// Crea el borrador del empleado en el periodo si aún no existe (sin borrar movimientos previos).
async function getOrCreateDraft(
  tx: Transaction,
  period: NonNullable<Awaited<ReturnType<typeof db.payrollPeriod.findUnique>>>,
  employee: NonNullable<Awaited<ReturnType<typeof db.employee.findUnique>>> & {
    branch: { name: string };
    position: { name: string };
  },
  userId: string,
) {
  const existing = await tx.payroll.findFirst({
    where: { periodId: period.id, employeeId: employee.id, status: { in: editableStatuses } },
    orderBy: { version: "desc" },
  });
  if (existing) return existing;
  const folio = await nextFolio(tx, FolioType.PAYROLL);
  return tx.payroll.create({
    data: {
      folio,
      periodId: period.id,
      employeeId: employee.id,
      branchId: employee.branchId,
      employeeNumberSnapshot: employee.employeeNumber,
      employeeNameSnapshot: fullName(employee),
      positionNameSnapshot: employee.position.name,
      branchNameSnapshot: employee.branch.name,
      periodNameSnapshot: period.name,
      periodStartSnapshot: period.startDate,
      periodEndSnapshot: period.endDate,
      baseSalarySnapshot: employee.baseSalary,
      baseDaysSnapshot: employee.baseDays,
      daysWorked: employee.baseDays,
      daysPaid: employee.baseDays,
      absences: 0,
      delays: 0,
      overtimeHours: 0,
      calculationModeSnapshot: employee.calculationMode,
      totalIncome: 0,
      totalDeductions: 0,
      netPay: 0,
      pendingBalance: 0,
      paymentMethod: employee.paymentMethod,
      generalNotes: null,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });
}

// Recalcula los totales del borrador a partir de TODOS sus movimientos y devuelve el estado.
async function recalcDraft(
  tx: Transaction,
  payrollId: string,
  userId: string,
  action: string,
  canSeeSalary: boolean,
): Promise<DraftState> {
  const payroll = await tx.payroll.findUniqueOrThrow({
    where: { id: payrollId },
    include: { items: { orderBy: { displayOrder: "asc" } } },
  });
  const calculation = calculatePayroll({
    baseSalary: payroll.baseSalarySnapshot.toString(),
    baseDays: payroll.baseDaysSnapshot.toString(),
    daysPaid: payroll.daysPaid.toString(),
    calculationMode: payroll.calculationModeSnapshot,
    lines: payroll.items.map((item) => ({ type: item.type, quantity: item.quantity.toString(), unitAmount: item.unitAmount.toString() })),
  });
  await tx.payroll.update({
    where: { id: payrollId },
    data: {
      totalIncome: calculation.totalIncome,
      totalDeductions: calculation.totalDeductions,
      netPay: calculation.netPay,
      pendingBalance: calculation.pendingBalance,
      updatedByUserId: userId,
    },
  });
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entityType: "Payroll",
      entityId: payrollId,
      branchId: payroll.branchId,
      newValues: { netPay: calculation.netPay },
    },
  });
  return redactSalary(
    {
      payrollId,
      basePay: calculation.basePay,
      totalIncome: calculation.totalIncome,
      totalDeductions: calculation.totalDeductions,
      netPay: calculation.netPay,
      status: payroll.status,
      items: toMovements(payroll.items),
    },
    canSeeSalary,
  );
}

export async function addPayrollMovement(input: MovementInput): Promise<DraftState> {
  const user = await requireUser("payroll:draft");
  const amount = new Decimal(input.amount);
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) throw new Error("El importe debe ser mayor a cero.");
  const [period, employee] = await Promise.all([
    db.payrollPeriod.findUnique({ where: { id: input.periodId } }),
    db.employee.findUnique({ where: { id: input.employeeId }, include: { branch: true, position: true } }),
  ]);
  if (!period || !employee) throw new Error("El periodo o empleado no existe.");
  assertBranchAccess(user, employee.branchId);
  assertBranchAccess(user, period.branchId);
  if (!["OPEN", "DRAFT"].includes(period.status)) throw new Error("El periodo no está abierto.");
  if (!employee.isActive) throw new Error("El empleado no está activo.");
  if (period.branchId && period.branchId !== employee.branchId) {
    throw new Error("El empleado no pertenece a la sucursal del periodo.");
  }
  const concept = await db.payrollConcept.findUnique({ where: { code: input.conceptCode } });
  if (!concept || !concept.isActive) throw new Error("El concepto no existe o está inactivo.");

  return db.$transaction(async (tx) => {
    const draft = await getOrCreateDraft(tx, period, employee, user.id);
    assertBranchAccess(user, draft.branchId);
    const highest = await tx.payrollItem.aggregate({ where: { payrollId: draft.id }, _max: { displayOrder: true } });
    await tx.payrollItem.create({
      data: {
        payrollId: draft.id,
        conceptId: concept.id,
        conceptCodeSnapshot: concept.code,
        conceptNameSnapshot: input.customName?.trim() || concept.name,
        type: concept.type,
        quantity: 1,
        unitAmount: amount.toFixed(2),
        totalAmount: amount.toFixed(2),
        notes: input.note?.trim() || null,
        displayOrder: (highest._max.displayOrder ?? -1) + 1,
      },
    });
    return recalcDraft(tx, draft.id, user.id, "ADD_MOVEMENT", canSeeSalary(user.role));
  });
}

export async function removePayrollMovement(payrollId: string, itemId: string): Promise<DraftState> {
  const user = await requireUser("payroll:draft");
  const payroll = await db.payroll.findUnique({
    where: { id: payrollId },
    include: { employee: { select: { branchId: true } } },
  });
  if (!payroll) throw new Error("La nómina no existe.");
  // La sucursal se valida por la nómina y por el empleado dueño de la misma.
  assertBranchAccess(user, payroll.branchId);
  assertBranchAccess(user, payroll.employee.branchId);
  if (!editableStatuses.includes(payroll.status)) throw new Error("La nómina ya no puede editarse.");
  return db.$transaction(async (tx) => {
    // Se revalida dentro de la transacción antes de borrar.
    const current = await tx.payroll.findFirst({
      where: { id: payrollId, branchId: payroll.branchId, status: { in: editableStatuses } },
    });
    if (!current) throw new Error("La nómina ya no puede editarse.");
    const deleted = await tx.payrollItem.deleteMany({ where: { id: itemId, payrollId } });
    if (deleted.count === 0) throw new Error("El movimiento no existe.");
    return recalcDraft(tx, payrollId, user.id, "REMOVE_MOVEMENT", canSeeSalary(user.role));
  });
}

export async function loadDraftState(periodId: string, employeeId: string): Promise<DraftState> {
  const user = await requireUser("payroll:draft");
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("El empleado no existe.");
  assertBranchAccess(user, employee.branchId);
  const draft = await db.payroll.findFirst({
    where: { periodId, employeeId, branchId: employee.branchId, status: { in: editableStatuses } },
    orderBy: { version: "desc" },
    include: { items: { orderBy: { displayOrder: "asc" } } },
  });
  const calculation = calculatePayroll({
    baseSalary: (draft?.baseSalarySnapshot ?? employee.baseSalary).toString(),
    baseDays: (draft?.baseDaysSnapshot ?? employee.baseDays).toString(),
    daysPaid: (draft?.daysPaid ?? employee.baseDays).toString(),
    calculationMode: draft?.calculationModeSnapshot ?? employee.calculationMode,
    lines: (draft?.items ?? []).map((item) => ({ type: item.type, quantity: item.quantity.toString(), unitAmount: item.unitAmount.toString() })),
  });
  return redactSalary(
    {
      payrollId: draft?.id ?? null,
      basePay: calculation.basePay,
      totalIncome: calculation.totalIncome,
      totalDeductions: calculation.totalDeductions,
      netPay: calculation.netPay,
      status: draft?.status ?? null,
      items: draft ? toMovements(draft.items) : [],
    },
    canSeeSalary(user.role),
  );
}

function receiptSnapshot(
  payroll: Awaited<ReturnType<typeof db.payroll.findUniqueOrThrow>> & {
    items: Array<{
      conceptCodeSnapshot: string;
      conceptNameSnapshot: string;
      type: ConceptType;
      quantity: { toString(): string };
      unitAmount: { toString(): string };
      totalAmount: { toString(): string };
      notes: string | null;
    }>;
  },
  receiptNumber: string,
  settings: Awaited<ReturnType<typeof db.systemSettings.findUniqueOrThrow>>,
  generatedBy: string,
) {
  return {
    receiptNumber,
    payrollFolio: payroll.folio,
    version: payroll.version,
    employeeNumber: payroll.employeeNumberSnapshot,
    employeeName: payroll.employeeNameSnapshot,
    positionName: payroll.positionNameSnapshot,
    branchName: payroll.branchNameSnapshot,
    periodName: payroll.periodNameSnapshot,
    periodStart: payroll.periodStartSnapshot.toISOString(),
    periodEnd: payroll.periodEndSnapshot.toISOString(),
    paymentMethod: payroll.paymentMethod,
    baseSalary: payroll.baseSalarySnapshot.toString(),
    totalIncome: payroll.totalIncome.toString(),
    totalDeductions: payroll.totalDeductions.toString(),
    netPay: payroll.netPay.toString(),
    pendingBalance: payroll.pendingBalance.toString(),
    notes: payroll.generalNotes,
    status: "FINALIZED",
    generatedAt: new Date().toISOString(),
    generatedBy,
    items: payroll.items.map((item) => ({
      code: item.conceptCodeSnapshot,
      name: item.conceptNameSnapshot,
      type: item.type,
      quantity: item.quantity.toString(),
      unitAmount: item.unitAmount.toString(),
      totalAmount: item.totalAmount.toString(),
      notes: item.notes,
    })),
    settings: {
      businessName: settings.businessName,
      logoUrl: settings.logoUrl,
      address: settings.address,
      phone: settings.phone,
      legalLegend: settings.legalLegend,
      receiptFooter: settings.receiptFooter,
      showEmployeeSignature: settings.showEmployeeSignature,
      showManagerSignature: settings.showManagerSignature,
      showQr: settings.showQr,
      showZeroConcepts: settings.showZeroConcepts,
    },
  };
}

export async function finalizePayroll(payrollId: string, confirmed: boolean, negativeReason?: string) {
  if (!confirmed) throw new Error("Debes confirmar que revisaste los importes.");
  const user = await requireUser("payroll:finalize");
  return db.$transaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({
      where: { id: payrollId },
      include: { items: true, employee: { select: { branchId: true } } },
    });
    const settings = await tx.systemSettings.findUnique({ where: { id: "default" } });
    if (!payroll || !settings) throw new Error("La nómina o configuración no existe.");
    // Revalidación dentro de la transacción, sobre la nómina y su empleado.
    assertBranchAccess(user, payroll.branchId);
    assertBranchAccess(user, payroll.employee.branchId);
    if (!editableStatuses.includes(payroll.status)) {
      throw new Error("La nómina ya no puede finalizarse.");
    }
    const calculation = calculatePayroll({
      baseSalary: payroll.baseSalarySnapshot.toString(),
      baseDays: payroll.baseDaysSnapshot.toString(),
      daysPaid: payroll.daysPaid.toString(),
      calculationMode: payroll.calculationModeSnapshot,
      lines: payroll.items.map((item) => ({
        type: item.type,
        quantity: item.quantity.toString(),
        unitAmount: item.unitAmount.toString(),
      })),
    });
    const isNegative = new Decimal(calculation.netPay).isNegative();
    if (isNegative && !settings.allowNegativeTotal) throw new Error("La configuración no permite totales negativos.");
    if (isNegative && settings.requireNegativeApproval && !negativeReason?.trim()) {
      throw new Error("La autorización de un total negativo requiere un motivo.");
    }
    const receiptNumber = await nextFolio(tx, FolioType.RECEIPT);
    const verificationToken = randomBytes(32).toString("hex");
    const finalized = await tx.payroll.update({
      where: { id: payroll.id },
      data: {
        status: PayrollStatus.FINALIZED,
        totalIncome: calculation.totalIncome,
        totalDeductions: calculation.totalDeductions,
        netPay: calculation.netPay,
        pendingBalance: calculation.pendingBalance,
        receiptToken: verificationToken,
        finalizedAt: new Date(),
        finalizedByUserId: user.id,
        negativeAuthorizedById: isNegative ? user.id : null,
        negativeAuthorizationReason: isNegative ? negativeReason : null,
        updatedByUserId: user.id,
      },
      include: { items: true },
    });
    await tx.payrollReceipt.create({
      data: {
        payrollId: payroll.id,
        receiptNumber,
        version: payroll.version,
        verificationToken,
        snapshot: receiptSnapshot(finalized, receiptNumber, settings, user.name) as Prisma.InputJsonValue,
        generatedByUserId: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "FINALIZE_PAYROLL",
        entityType: "Payroll",
        entityId: payroll.id,
        branchId: payroll.branchId,
        newValues: { status: "FINALIZED", receiptNumber, netPay: calculation.netPay },
        reason: negativeReason,
      },
    });
    return finalized;
  });
}

export interface PaymentInput {
  payrollId: string;
  paymentMethod: "CASH" | "TRANSFER" | "MIXED" | "OTHER";
  cashAmount: string;
  transferAmount: string;
  otherAmount: string;
  transferReference?: string;
  receivedByName: string;
  notes?: string;
}

export async function markPayrollPaid(input: PaymentInput) {
  const user = await requireUser("payroll:finalize");
  return db.$transaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({
      where: { id: input.payrollId },
      include: { employee: { select: { branchId: true } } },
    });
    if (!payroll) throw new Error("La nómina no existe.");
    assertBranchAccess(user, payroll.branchId);
    assertBranchAccess(user, payroll.employee.branchId);
    if (payroll.status !== PayrollStatus.FINALIZED) throw new Error("Solo una nómina finalizada puede pagarse.");
    if (payroll.netPay.isNegative()) throw new Error("Una nómina con saldo pendiente no puede marcarse como pagada.");
    validateMixedPayment(payroll.netPay.toString(), input.cashAmount, input.transferAmount, input.otherAmount);
    await tx.payrollPayment.create({
      data: {
        payrollId: payroll.id,
        paymentMethod: input.paymentMethod,
        cashAmount: input.cashAmount,
        transferAmount: input.transferAmount,
        otherAmount: input.otherAmount,
        transferReference: input.transferReference,
        paidAt: new Date(),
        deliveredByUserId: user.id,
        receivedByName: input.receivedByName,
        notes: input.notes,
      },
    });
    const paid = await tx.payroll.update({
      where: { id: payroll.id },
      data: { status: PayrollStatus.PAID, paidAt: new Date(), paidByUserId: user.id, updatedByUserId: user.id },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "PAY_PAYROLL",
        entityType: "Payroll",
        entityId: payroll.id,
        branchId: payroll.branchId,
        newValues: { status: "PAID", paymentMethod: input.paymentMethod },
      },
    });
    return paid;
  });
}

export async function cancelPayroll(payrollId: string, reason: string, password: string) {
  const user = await requireUser("payroll:cancel");
  if (!reason.trim()) throw new Error("El motivo es obligatorio.");
  const account = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const settings = await db.systemSettings.findUniqueOrThrow({ where: { id: "default" } });
  if (settings.requireCancellationPassword && !(await compare(password, account.passwordHash))) {
    throw new Error("La contraseña de confirmación no es correcta.");
  }
  return db.$transaction(async (tx) => {
    const payroll = await tx.payroll.findUnique({
      where: { id: payrollId },
      include: { employee: { select: { branchId: true } } },
    });
    if (!payroll) throw new Error("La nómina no existe.");
    assertBranchAccess(user, payroll.branchId);
    assertBranchAccess(user, payroll.employee.branchId);
    if (!cancellableStatuses.includes(payroll.status)) {
      throw new Error("Esta nómina no puede cancelarse.");
    }
    const cancelled = await tx.payroll.update({
      where: { id: payroll.id },
      data: {
        status: PayrollStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: user.id,
        cancellationReason: reason,
        updatedByUserId: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CANCEL_PAYROLL",
        entityType: "Payroll",
        entityId: payroll.id,
        branchId: payroll.branchId,
        previousValues: { status: payroll.status },
        newValues: { status: "CANCELLED" },
        reason,
      },
    });
    return cancelled;
  });
}

export async function replacePayroll(payrollId: string, reason: string) {
  const user = await requireUser("payroll:cancel");
  if (!reason.trim()) throw new Error("El motivo es obligatorio.");
  return db.$transaction(async (tx) => {
    const original = await tx.payroll.findUnique({
      where: { id: payrollId },
      include: { items: true, employee: { select: { branchId: true } } },
    });
    if (!original || !replaceableStatuses.includes(original.status)) {
      throw new Error("Esta nómina no puede reemplazarse.");
    }
    assertBranchAccess(user, original.branchId);
    assertBranchAccess(user, original.employee.branchId);
    const folio = await nextFolio(tx, FolioType.PAYROLL);
    const replacement = await tx.payroll.create({
      data: {
        folio,
        version: original.version + 1,
        periodId: original.periodId,
        employeeId: original.employeeId,
        branchId: original.branchId,
        status: PayrollStatus.DRAFT,
        employeeNumberSnapshot: original.employeeNumberSnapshot,
        employeeNameSnapshot: original.employeeNameSnapshot,
        positionNameSnapshot: original.positionNameSnapshot,
        branchNameSnapshot: original.branchNameSnapshot,
        periodNameSnapshot: original.periodNameSnapshot,
        periodStartSnapshot: original.periodStartSnapshot,
        periodEndSnapshot: original.periodEndSnapshot,
        baseSalarySnapshot: original.baseSalarySnapshot,
        baseDaysSnapshot: original.baseDaysSnapshot,
        daysWorked: original.daysWorked,
        daysPaid: original.daysPaid,
        absences: original.absences,
        delays: original.delays,
        overtimeHours: original.overtimeHours,
        calculationModeSnapshot: original.calculationModeSnapshot,
        totalIncome: original.totalIncome,
        totalDeductions: original.totalDeductions,
        netPay: original.netPay,
        pendingBalance: original.pendingBalance,
        paymentMethod: original.paymentMethod,
        generalNotes: original.generalNotes,
        previousPayrollId: original.id,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        items: {
          create: original.items.map((item) => ({
            conceptId: item.conceptId,
            conceptCodeSnapshot: item.conceptCodeSnapshot,
            conceptNameSnapshot: item.conceptNameSnapshot,
            type: item.type,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            totalAmount: item.totalAmount,
            referenceDate: item.referenceDate,
            reference: item.reference,
            notes: item.notes,
            displayOrder: item.displayOrder,
          })),
        },
      },
    });
    await tx.payroll.update({
      where: { id: original.id },
      data: { status: PayrollStatus.REPLACED, cancellationReason: reason, updatedByUserId: user.id },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REPLACE_PAYROLL",
        entityType: "Payroll",
        entityId: original.id,
        branchId: original.branchId,
        newValues: { status: "REPLACED", replacementId: replacement.id },
        reason,
      },
    });
    return replacement;
  });
}
