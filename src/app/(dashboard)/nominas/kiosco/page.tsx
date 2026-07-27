import { CaptureTabs } from "@/components/capture-tabs";
import { KioskCapture } from "@/components/kiosk-capture";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Captura por empleado" };

export default async function KioskPage() {
  const user = await requireUser("payroll:draft");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const branchWhere = user.role === "SUPER_ADMIN" ? { isActive: true } : { id: { in: user.branchIds }, isActive: true };
  const [branches, openPeriods, concepts] = await Promise.all([
    db.branch.findMany({
      where: branchWhere,
      orderBy: { name: "asc" },
      include: {
        employees: {
          where: { isActive: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, employeeNumber: true, firstName: true, lastName: true, secondLastName: true, baseSalary: true, position: { select: { name: true } } },
        },
      },
    }),
    db.payrollPeriod.findMany({
      where: {
        status: { in: ["DRAFT", "OPEN"] },
        ...(user.role === "SUPER_ADMIN" ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
      },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, folio: true, branchId: true },
    }),
    db.payrollConcept.findMany({
      where: { isActive: true, showInQuickCapture: true, code: { not: "BASE_SALARY" } },
      orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      select: { code: true, name: true, type: true },
    }),
  ]);

  const branchData = branches.map((branch) => {
    const period = openPeriods.find((item) => item.branchId === branch.id) ?? openPeriods.find((item) => item.branchId === null) ?? null;
    return {
      id: branch.id,
      name: branch.name,
      color: branch.color,
      period: period ? { id: period.id, name: period.name, folio: period.folio } : null,
      employees: branch.employees.map((employee) => ({
        id: employee.id,
        name: fullName(employee),
        number: employee.employeeNumber,
        position: employee.position.name,
        baseSalary: canSeeSalary ? employee.baseSalary.toString() : null,
      })),
    };
  });

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Nómina</p>
          <h1 className="page-title">Captura por empleado</h1>
          <p className="muted text-sm">Adelantos, consumos, faltas y bonos en segundos.</p>
        </div>
      </div>
      <CaptureTabs />
      <KioskCapture branches={branchData} concepts={concepts} canFinalize={hasPermission(user.role, "payroll:finalize")} />
    </>
  );
}
