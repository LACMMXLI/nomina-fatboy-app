"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ConceptType, FolioType, Prisma, Role } from "@/generated/prisma/client";
import { actionError, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canManageUser, hasPermission } from "@/lib/permissions";
import type { QuickCaptureData } from "@/lib/quick-capture";
import { ForbiddenError, assertBranchAccess, requireUser } from "@/server/auth";
import {
  addPayrollMovement,
  cancelPayroll,
  finalizePayroll,
  loadDraftState,
  markPayrollPaid,
  nextFolio,
  removePayrollMovement,
  replacePayroll,
  savePayrollDraft,
} from "@/server/payroll";
import { employeeSchema, movementSchema, payrollDraftSchema, periodSchema } from "@/server/validators";

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalid<T = unknown>(error: z.ZodError): ActionResult<T> {
  return { ok: false, fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
}

export async function createEmployeeAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = employeeSchema.safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await requireUser("employees:manage");
    // La sucursal viene del formulario: se valida contra las asignadas al usuario.
    assertBranchAccess(user, parsed.data.branchId);
    const employee = await db.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          ...parsed.data,
          secondLastName: parsed.data.secondLastName || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          notes: parsed.data.notes || null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE_EMPLOYEE",
          entityType: "Employee",
          entityId: created.id,
          branchId: created.branchId,
          newValues: { employeeNumber: created.employeeNumber, baseSalary: created.baseSalary.toString() },
        },
      });
      return created;
    });
    return { ok: true, data: { id: employee.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEmployeeSalaryAction(formData: FormData) {
  const schema = z.object({
    employeeId: z.string().uuid(),
    newSalary: z.coerce.number().min(0),
    effectiveDate: z.coerce.date(),
    reason: z.string().trim().min(3),
  });
  const parsed = schema.safeParse(fields(formData));
  if (!parsed.success) throw new Error("Revisa el nuevo sueldo, fecha efectiva y motivo.");
  try {
    const user = await requireUser("employees:manage");
    await db.$transaction(async (tx) => {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: parsed.data.employeeId } });
      // Revalidación dentro de la transacción, antes de escribir.
      assertBranchAccess(user, employee.branchId);
      await tx.employeeSalaryHistory.create({
        data: {
          employeeId: employee.id,
          previousSalary: employee.baseSalary,
          newSalary: parsed.data.newSalary,
          effectiveDate: parsed.data.effectiveDate,
          reason: parsed.data.reason,
          changedByUserId: user.id,
        },
      });
      await tx.employee.update({
        where: { id: employee.id },
        data: { baseSalary: parsed.data.newSalary },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CHANGE_EMPLOYEE_SALARY",
          entityType: "Employee",
          entityId: employee.id,
          branchId: employee.branchId,
          previousValues: { baseSalary: employee.baseSalary.toString() },
          newValues: { baseSalary: parsed.data.newSalary },
          reason: parsed.data.reason,
        },
      });
    });
    revalidatePath(`/empleados/${parsed.data.employeeId}`);
  } catch (error) {
    throw new Error(actionError(error).error);
  }
}

export async function toggleEmployeeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const user = await requireUser("employees:manage");
  const employee = await db.employee.findUniqueOrThrow({ where: { id } });
  assertBranchAccess(user, employee.branchId);
  await db.$transaction([
    db.employee.update({ where: { id }, data: { isActive: !employee.isActive } }),
    db.auditLog.create({
      data: {
        userId: user.id,
        action: employee.isActive ? "DEACTIVATE_EMPLOYEE" : "REACTIVATE_EMPLOYEE",
        entityType: "Employee",
        entityId: id,
        branchId: employee.branchId,
      },
    }),
  ]);
  revalidatePath("/empleados");
}

export async function createPeriodAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = periodSchema.safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const user = await requireUser("periods:manage");
    // Un periodo sin sucursal abarca todas: solo el super admin puede crearlo.
    if (!parsed.data.branchId && user.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Debes elegir una sucursal a la que tengas acceso.");
    }
    assertBranchAccess(user, parsed.data.branchId || null);
    const branchId = parsed.data.branchId || null;
    const period = await db.$transaction(
      async (tx) => {
        // Dos rangos se traslapan si cada uno empieza antes de que el otro termine.
        // Un periodo sin sucursal cubre todas, así que choca con cualquiera;
        // uno de sucursal choca con los de su sucursal y con los generales.
        const overlapping = await tx.payrollPeriod.findFirst({
          where: {
            status: { not: "CANCELLED" },
            startDate: { lte: parsed.data.endDate },
            endDate: { gte: parsed.data.startDate },
            ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
          },
          include: { branch: { select: { name: true } } },
          orderBy: { startDate: "asc" },
        });
        if (overlapping) {
          throw new Error(
            `El periodo se traslapa con ${overlapping.folio} (${overlapping.branch?.name ?? "todas las sucursales"}), del ${formatDate(overlapping.startDate)} al ${formatDate(overlapping.endDate)}.`,
          );
        }
        const folio = await nextFolio(tx, FolioType.PERIOD);
        const created = await tx.payrollPeriod.create({
          data: {
            ...parsed.data,
            branchId,
            folio,
            status: "OPEN",
            openedAt: new Date(),
            createdByUserId: user.id,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "CREATE_PERIOD",
            entityType: "PayrollPeriod",
            entityId: created.id,
            branchId: created.branchId,
            newValues: { folio, status: "OPEN" },
          },
        });
        return created;
      },
      // Serializable evita que dos altas simultáneas pasen la comprobación
      // de traslape a la vez y acaben insertando periodos superpuestos.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { ok: true, data: { id: period.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function savePayrollAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = payrollDraftSchema.safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const payroll = await savePayrollDraft(parsed.data);
    return { ok: true, data: { id: payroll.id, updatedAt: payroll.updatedAt.toISOString() } };
  } catch (error) {
    return {
      ...actionError(error),
      conflict: Boolean(error && typeof error === "object" && "conflict" in error),
    };
  }
}

export async function addMovementAction(input: unknown): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const state = await addPayrollMovement({ ...parsed.data, amount: String(parsed.data.amount) });
    return { ok: true, data: state };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeMovementAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ payrollId: z.string().uuid(), itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const state = await removePayrollMovement(parsed.data.payrollId, parsed.data.itemId);
    return { ok: true, data: state };
  } catch (error) {
    return actionError(error);
  }
}

export async function loadMovementsAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ periodId: z.string().uuid(), employeeId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const state = await loadDraftState(parsed.data.periodId, parsed.data.employeeId);
    return { ok: true, data: state };
  } catch (error) {
    return actionError(error);
  }
}

// Catálogo plano para el buscador global: un empleado ya trae resuelto su periodo abierto,
// así el atajo no obliga a elegir sucursal ni periodo antes de capturar.
export async function quickCaptureDataAction(): Promise<ActionResult<QuickCaptureData>> {
  try {
    const user = await requireUser("payroll:draft");
    const canSeeSalary = hasPermission(user.role, "salary:view");
    const branchFilter = user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } };
    const [employees, periods, concepts] = await Promise.all([
      db.employee.findMany({
        where: { isActive: true, ...branchFilter },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          secondLastName: true,
          baseSalary: true,
          branchId: true,
          branch: { select: { name: true, color: true } },
          position: { select: { name: true } },
        },
      }),
      db.payrollPeriod.findMany({
        where: {
          status: { in: ["DRAFT", "OPEN"] },
          ...(user.role === "SUPER_ADMIN" ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
        },
        orderBy: { startDate: "desc" },
        select: { id: true, name: true, branchId: true },
      }),
      db.payrollConcept.findMany({
        where: { isActive: true, showInQuickCapture: true, code: { not: "BASE_SALARY" } },
        orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true, type: true },
      }),
    ]);
    const globalPeriod = periods.find((period) => period.branchId === null) ?? null;
    return {
      ok: true,
      data: {
        concepts: concepts.map((concept) => ({ code: concept.code, name: concept.name, type: concept.type })),
        employees: employees.map((employee) => {
          const period = periods.find((item) => item.branchId === employee.branchId) ?? globalPeriod;
          return {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}${employee.secondLastName ? ` ${employee.secondLastName}` : ""}`,
            number: employee.employeeNumber,
            position: employee.position.name,
            branchName: employee.branch.name,
            branchColor: employee.branch.color,
            baseSalary: canSeeSalary ? employee.baseSalary.toString() : null,
            periodId: period?.id ?? null,
            periodName: period?.name ?? null,
          };
        }),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

// Finaliza sin salir de la pantalla de captura; devuelve el error en vez de lanzarlo
// para que el cliente lo muestre con un aviso y no con una pantalla de error.
export async function quickFinalizeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({ payrollId: z.string().uuid(), negativeReason: z.string().trim().optional() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const payroll = await finalizePayroll(parsed.data.payrollId, true, parsed.data.negativeReason);
    revalidatePath(`/nominas/${payroll.id}`);
    return { ok: true, data: { id: payroll.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function finalizePayrollAction(formData: FormData) {
  let payrollId: string;
  try {
    const payroll = await finalizePayroll(
      String(formData.get("payrollId")),
      formData.get("confirmed") === "on",
      String(formData.get("negativeReason") ?? ""),
    );
    payrollId = payroll.id;
  } catch (error) {
    throw new Error(actionError(error).error);
  }
  redirect(`/nominas/${payrollId}`);
}

export async function markPaidAction(formData: FormData) {
  const payroll = await markPayrollPaid({
    payrollId: String(formData.get("payrollId")),
    paymentMethod: String(formData.get("paymentMethod")) as "CASH" | "TRANSFER" | "MIXED" | "OTHER",
    cashAmount: String(formData.get("cashAmount") ?? "0"),
    transferAmount: String(formData.get("transferAmount") ?? "0"),
    otherAmount: String(formData.get("otherAmount") ?? "0"),
    transferReference: String(formData.get("transferReference") ?? ""),
    receivedByName: String(formData.get("receivedByName") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  redirect(`/nominas/${payroll.id}`);
}

export async function cancelPayrollAction(formData: FormData) {
  const payroll = await cancelPayroll(
    String(formData.get("payrollId")),
    String(formData.get("reason")),
    String(formData.get("password")),
  );
  redirect(`/nominas/${payroll.id}`);
}

export async function replacePayrollAction(formData: FormData) {
  const payroll = await replacePayroll(String(formData.get("payrollId")), String(formData.get("reason")));
  redirect(`/nominas/captura?periodId=${payroll.periodId}&employeeId=${payroll.employeeId}&payrollId=${payroll.id}`);
}

export async function createBranchAction(formData: FormData) {
  const schema = z.object({
    code: z.string().trim().min(2).max(10),
    name: z.string().trim().min(2),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    managerName: z.string().trim().optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
  });
  const parsed = schema.parse(fields(formData));
  const user = await requireUser("settings:manage");
  const branch = await db.branch.create({ data: parsed });
  await db.auditLog.create({
    data: { userId: user.id, action: "CREATE_BRANCH", entityType: "Branch", entityId: branch.id },
  });
  revalidatePath("/sucursales");
}

export async function createPositionAction(formData: FormData) {
  const parsed = z
    .object({ code: z.string().trim().min(2), name: z.string().trim().min(2), description: z.string().optional() })
    .parse(fields(formData));
  await requireUser("settings:manage");
  await db.position.create({ data: parsed });
  revalidatePath("/puestos");
}

export async function createConceptAction(formData: FormData) {
  const parsed = z
    .object({
      code: z.string().trim().min(2),
      name: z.string().trim().min(2),
      type: z.enum(["INCOME", "DEDUCTION"]),
    })
    .parse(fields(formData));
  await requireUser("settings:manage");
  await db.payrollConcept.create({ data: { ...parsed, type: parsed.type as ConceptType } });
  revalidatePath("/conceptos");
}

export async function createUserAction(formData: FormData) {
  const parsed = z
    .object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      email: z.email(),
      username: z.string().trim().min(3),
      password: z.string().min(12),
      role: z.enum(["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO", "CONSULTA"]),
      branchIds: z.array(z.string().uuid()).default([]),
    })
    .parse({
      ...fields(formData),
      branchIds: formData.getAll("branchIds"),
    });
  const actor = await requireUser("users:manage");
  const { password, branchIds, ...userData } = parsed;
  const user = await db.user.create({
    data: {
      ...userData,
      role: userData.role as Role,
      passwordHash: await hash(password, 12),
      preference: { create: {} },
      branches: { create: branchIds.map((branchId) => ({ branchId })) },
    },
  });
  await db.auditLog.create({
    data: { userId: actor.id, action: "CREATE_USER", entityType: "User", entityId: user.id },
  });
  revalidatePath("/usuarios");
}

export async function updateUserAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      updatedAt: z.coerce.date(),
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      email: z.email(),
      username: z.string().trim().min(3),
      role: z.enum(["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO", "CONSULTA"]).optional(),
      branchIds: z.array(z.string().uuid()).default([]),
    })
    .safeParse({ ...fields(formData), branchIds: formData.getAll("branchIds") });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const actor = await requireUser();
    if (!canManageUser(actor.role, actor.id, parsed.data.userId)) throw new Error("No puedes editar este usuario.");
    const duplicate = await db.user.findFirst({
      where: {
        id: { not: parsed.data.userId },
        OR: [{ email: parsed.data.email }, { username: parsed.data.username }],
      },
    });
    if (duplicate) throw new Error("El correo o nombre de usuario ya está en uso.");
    const administrativeEdit = actor.role === "SUPER_ADMIN" && actor.id !== parsed.data.userId;
    await db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: parsed.data.userId, updatedAt: parsed.data.updatedAt },
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email,
          username: parsed.data.username,
          ...(administrativeEdit && parsed.data.role
            ? { role: parsed.data.role as Role, isActive: formData.get("isActive") === "on" }
            : {}),
        },
      });
      if (updated.count !== 1) throw new Error("Otro usuario modificó esta cuenta. Recarga la página.");
      if (administrativeEdit) {
        await tx.userBranch.deleteMany({ where: { userId: parsed.data.userId } });
        if (parsed.data.branchIds.length) {
          await tx.userBranch.createMany({
            data: parsed.data.branchIds.map((branchId) => ({ userId: parsed.data.userId, branchId })),
          });
        }
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "UPDATE_USER",
          entityType: "User",
          entityId: parsed.data.userId,
          newValues: { username: parsed.data.username, email: parsed.data.email },
        },
      });
    });
    return { ok: true, data: { id: parsed.data.userId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function changeUserPasswordAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      currentPassword: z.string().min(1, "Confirma tu contraseña actual."),
      newPassword: z.string().min(12, "La nueva contraseña debe tener al menos 12 caracteres."),
      confirmPassword: z.string(),
    })
    .refine((value) => value.newPassword === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Las contraseñas no coinciden.",
    })
    .safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const actor = await requireUser();
    if (!canManageUser(actor.role, actor.id, parsed.data.userId)) throw new Error("No puedes cambiar esta contraseña.");
    const account = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await compare(parsed.data.currentPassword, account.passwordHash))) {
      throw new Error("Tu contraseña actual es incorrecta.");
    }
    await db.$transaction([
      db.user.update({
        where: { id: parsed.data.userId },
        data: { passwordHash: await hash(parsed.data.newPassword, 12), authVersion: { increment: 1 } },
      }),
      db.auditLog.create({
        data: {
          userId: actor.id,
          action: "CHANGE_USER_PASSWORD",
          entityType: "User",
          entityId: parsed.data.userId,
        },
      }),
    ]);
    return { ok: true, data: { self: actor.id === parsed.data.userId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSettingsAction(formData: FormData) {
  const parsed = z
    .object({
      businessName: z.string().trim().min(1),
      primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      address: z.string().optional(),
      phone: z.string().optional(),
      receiptFooter: z.string().optional(),
      legalLegend: z.string().trim().min(1),
      timezone: z.string().trim().min(1),
    })
    .parse(fields(formData));
  const user = await requireUser("settings:manage");
  const previous = await db.systemSettings.findUniqueOrThrow({ where: { id: "default" } });
  await db.$transaction([
    db.systemSettings.update({
      where: { id: "default" },
      data: {
        ...parsed,
        allowNegativeTotal: formData.get("allowNegativeTotal") === "on",
        requireNegativeApproval: formData.get("requireNegativeApproval") === "on",
        requireCancellationPassword: formData.get("requireCancellationPassword") === "on",
        showEmployeeSignature: formData.get("showEmployeeSignature") === "on",
        showManagerSignature: formData.get("showManagerSignature") === "on",
        showQr: formData.get("showQr") === "on",
      },
    }),
    db.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_SETTINGS",
        entityType: "SystemSettings",
        entityId: "default",
        previousValues: { businessName: previous.businessName },
        newValues: { businessName: parsed.businessName },
      },
    }),
  ]);
  revalidatePath("/configuracion");
}
