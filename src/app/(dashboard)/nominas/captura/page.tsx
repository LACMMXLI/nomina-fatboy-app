import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CapturePicker } from "@/components/capture-picker";
import { CaptureTabs } from "@/components/capture-tabs";
import { PayrollForm } from "@/components/payroll-form";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Captura detallada" };

export default async function PayrollCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ periodId?: string; employeeId?: string; payrollId?: string }>;
}) {
  const user = await requireUser("payroll:draft");
  const params = await searchParams;
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const branchScope = user.role === "SUPER_ADMIN" ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] };

  // Sin empleado elegido: una sola pantalla con periodo + buscador, sin recargas intermedias.
  if (!params.periodId || !params.employeeId) {
    const periods = await db.payrollPeriod.findMany({
      where: { status: { in: ["DRAFT", "OPEN"] }, ...branchScope },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, folio: true, branchId: true },
    });
    const employees = await db.employee.findMany({
      where: { isActive: true, ...(user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } }) },
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
        // Solo interesa el estado en los periodos que el selector puede mostrar.
        payrolls: {
          where: { periodId: { in: periods.map((period) => period.id) } },
          select: { periodId: true, status: true },
        },
      },
    });
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Nómina</p>
            <h1 className="page-title">Captura detallada</h1>
            <p className="muted text-sm">Elige al empleado y abre su captura al instante.</p>
          </div>
        </div>
        <CaptureTabs periodId={params.periodId} />
        <CapturePicker
          destination="/nominas/captura"
          periods={periods}
          employees={employees.map((employee) => ({
            id: employee.id,
            name: fullName(employee),
            number: employee.employeeNumber,
            position: employee.position.name,
            branchId: employee.branchId,
            branchName: employee.branch.name,
            branchColor: employee.branch.color,
            baseSalary: canSeeSalary ? employee.baseSalary.toString() : null,
            capturedIn: Object.fromEntries(employee.payrolls.map((payroll) => [payroll.periodId, payroll.status])),
          }))}
        />
      </>
    );
  }

  const [period, employee, existing] = await Promise.all([
    db.payrollPeriod.findUniqueOrThrow({ where: { id: params.periodId } }),
    db.employee.findUniqueOrThrow({ where: { id: params.employeeId }, include: { branch: true, position: true } }),
    params.payrollId
      ? db.payroll.findUnique({ where: { id: params.payrollId }, include: { items: true } })
      : db.payroll.findFirst({
          where: { periodId: params.periodId, employeeId: params.employeeId, status: { in: ["DRAFT", "IN_REVIEW"] } },
          include: { items: true },
          orderBy: { version: "desc" },
        }),
  ]);
  await requireUser("payroll:draft", employee.branchId);
  return (
    <>
      <div className="page-header">
        <div className="min-w-0">
          <p className="eyebrow">{period.folio} · {period.name}</p>
          <h1 className="page-title truncate">{fullName(employee)}</h1>
          <p className="muted text-sm">{employee.employeeNumber} · {employee.position.name} · {employee.branch.name}</p>
        </div>
        <Link className="button-secondary" href="/nominas/captura"><ArrowLeft size={16} /> Cambiar empleado</Link>
      </div>
      <PayrollForm
        periodId={period.id}
        employeeId={employee.id}
        employee={{
          name: fullName(employee),
          number: employee.employeeNumber,
          position: employee.position.name,
          branch: employee.branch.name,
          baseSalary: canSeeSalary ? employee.baseSalary.toString() : null,
          baseDays: employee.baseDays.toString(),
          calculationMode: employee.calculationMode,
        }}
        payroll={
          existing
            ? {
                id: existing.id,
                updatedAt: existing.updatedAt.toISOString(),
                daysWorked: existing.daysWorked.toString(),
                daysPaid: existing.daysPaid.toString(),
                absences: existing.absences.toString(),
                delays: existing.delays.toString(),
                overtimeHours: existing.overtimeHours.toString(),
                paymentMethod: existing.paymentMethod,
                generalNotes: existing.generalNotes ?? "",
                items: existing.items.map((item) => ({ code: item.conceptCodeSnapshot, amount: item.totalAmount.toString() })),
              }
            : undefined
        }
      />
    </>
  );
}
