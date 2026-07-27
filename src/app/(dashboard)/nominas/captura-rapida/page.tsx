import Link from "next/link";
import { redirect } from "next/navigation";
import { CaptureTabs } from "@/components/capture-tabs";
import { PeriodSwitcher } from "@/components/period-switcher";
import { QuickCaptureTable } from "@/components/quick-capture-table";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import { assertBranchAccess, requireUser } from "@/server/auth";

export const metadata = { title: "Tabla del periodo" };

export default async function QuickCapturePage({ searchParams }: { searchParams: Promise<{ periodId?: string }> }) {
  const user = await requireUser("payroll:draft");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const { periodId } = await searchParams;
  const periods = await db.payrollPeriod.findMany({
    where: {
      status: { in: ["DRAFT", "OPEN"] },
      ...(user.role === "SUPER_ADMIN" ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
    },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, folio: true },
  });

  if (!periods.length) {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Nómina</p>
            <h1 className="page-title">Tabla del periodo</h1>
          </div>
        </div>
        <CaptureTabs />
        <div className="empty-state">
          <p className="font-semibold">Todavía no hay un periodo abierto.</p>
          <p className="muted text-sm">Crea el periodo de la semana para capturar a todos los empleados de una sola vez.</p>
          <Link className="button-primary" href="/periodos/nuevo">Crear periodo</Link>
        </div>
      </>
    );
  }

  // El periodo abierto más reciente es el que casi siempre se quiere: se elige solo.
  if (!periodId) redirect(`/nominas/captura-rapida?periodId=${periods[0].id}`);

  const period = await db.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } });
  assertBranchAccess(user, period.branchId);
  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      ...(period.branchId ? { branchId: period.branchId } : user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } }),
    },
    include: { branch: true, payrolls: { where: { periodId }, include: { items: true }, orderBy: { version: "desc" }, take: 1 } },
    orderBy: { lastName: "asc" },
    take: 100,
  });
  const rows = employees.map((employee) => {
    const payroll = employee.payrolls[0];
    const item = (code: string) => payroll?.items.find((candidate) => candidate.conceptCodeSnapshot === code)?.totalAmount.toString() ?? "0";
    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName: fullName(employee),
      baseSalary: canSeeSalary ? employee.baseSalary.toString() : null,
      baseDays: employee.baseDays.toString(),
      calculationMode: employee.calculationMode,
      paymentMethod: payroll?.paymentMethod ?? employee.paymentMethod,
      payrollId: payroll?.id,
      updatedAt: payroll?.updatedAt.toISOString(),
      daysPaid: payroll?.daysPaid.toString() ?? employee.baseDays.toString(),
      bonus: item("BONUS"),
      overtimeAmount: item("OVERTIME"),
      advance: item("ADVANCE"),
      loan: item("LOAN"),
      consumption: item("CONSUMPTION"),
      otherDeduction: item("OTHER_DEDUCTION"),
    };
  });
  const captured = rows.filter((row) => row.payrollId).length;

  return (
    <>
      <div className="page-header">
        <div className="min-w-0">
          <p className="eyebrow">{period.folio}</p>
          <h1 className="page-title truncate">{period.name}</h1>
          <p className="muted text-sm">Se guarda solo al salir de cada casilla · {captured} de {rows.length} capturados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSwitcher periods={periods} current={period.id} basePath="/nominas/captura-rapida" />
          <Link className="button-secondary" href={`/periodos/${period.id}`}>Ver periodo</Link>
        </div>
      </div>
      <CaptureTabs periodId={period.id} />
      <div className="progress no-print mb-4">
        <div className="progress-bar" style={{ width: `${rows.length ? Math.round((captured / rows.length) * 100) : 0}%` }} />
      </div>
      <QuickCaptureTable periodId={period.id} initialRows={rows} />
    </>
  );
}
