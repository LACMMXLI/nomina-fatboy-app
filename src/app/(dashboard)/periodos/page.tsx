import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { PAID_STATUSES, PENDING_STATUSES, countableWhere, sumNet, uniqueEmployees } from "@/lib/payroll-reporting";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Periodos" };

export default async function PeriodsPage() {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const periods = await db.payrollPeriod.findMany({
    where: user.role === "SUPER_ADMIN" ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] },
    // Solo nóminas contables (PAID/FINALIZED) y en su última versión.
    include: { branch: true, payrolls: { where: countableWhere, select: { status: true, netPay: true, employeeId: true } } },
    orderBy: { startDate: "desc" },
    take: 50,
  });
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Periodos de nómina</h1><p className="muted text-sm">Semanas y rangos disponibles para captura.</p></div>
        {["SUPER_ADMIN", "ADMINISTRADOR"].includes(user.role) && <Link className="button-primary" href="/periodos/nuevo">Crear periodo</Link>}
      </div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Folio</th><th>Periodo</th><th>Fechas</th><th>Sucursal</th><th>Estado</th><th>Empleados</th>{canSeeSalary && <th>Pagado</th>}{canSeeSalary && <th>Pendiente</th>}</tr></thead><tbody>
        {periods.map((period) => <tr key={period.id}><td><Link className="font-semibold text-red-600" href={`/periodos/${period.id}`}>{period.folio}</Link></td><td>{period.name}</td><td>{formatDate(period.startDate)} – {formatDate(period.endDate)}</td><td>{period.branch?.name ?? "Todas"}</td><td><Badge value={period.status} /></td><td>{uniqueEmployees(period.payrolls)}</td>{canSeeSalary && <td>{formatMoney(sumNet(period.payrolls, PAID_STATUSES))}</td>}{canSeeSalary && <td>{formatMoney(sumNet(period.payrolls, PENDING_STATUSES))}</td>}</tr>)}
      </tbody></table>{!periods.length && <div className="p-12 text-center"><p className="muted mb-4">No hay un periodo abierto.</p><Link className="button-primary" href="/periodos/nuevo">Crear periodo</Link></div>}</div>
    </>
  );
}
