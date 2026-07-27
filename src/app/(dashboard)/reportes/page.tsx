import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { PAID_STATUSES, PENDING_STATUSES, countableWhere, paidWhere, pendingWhere, sumNet, uniqueEmployees } from "@/lib/payroll-reporting";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export default async function ReportsPage() {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const canExport = hasPermission(user.role, "exports:create");
  const scope = user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } };
  // Solo cuentan PAID y FINALIZED, y solo la última versión de cada nómina.
  const where = { ...scope, ...countableWhere };
  const [paid, pending, countable, byBranch, byConcept] = await Promise.all([
    db.payroll.aggregate({ where: { ...scope, ...paidWhere }, _count: true, _sum: { netPay: true } }),
    db.payroll.aggregate({ where: { ...scope, ...pendingWhere }, _count: true, _sum: { netPay: true } }),
    db.payroll.findMany({ where, select: { employeeId: true, totalIncome: true, totalDeductions: true } }),
    db.branch.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }, include: { payrolls: { where, select: { netPay: true, status: true, employeeId: true } } }, orderBy: { name: "asc" } }),
    db.payrollItem.groupBy({ by: ["conceptNameSnapshot", "type"], where: { payroll: where }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 15 }),
  ]);
  const totalPagado = Number(paid._sum.netPay ?? 0);
  const totalPendiente = Number(pending._sum.netPay ?? 0);
  const totalIngresos = countable.reduce((total, row) => total + Number(row.totalIncome), 0);
  const totalDescuentos = countable.reduce((total, row) => total + Number(row.totalDeductions), 0);
  const empleadosUnicos = uniqueEmployees(countable);
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Reportes</h1><p className="muted text-sm">Consolidado de nómina por sucursal y concepto.</p></div>{canExport && <div className="flex gap-2"><Link className="button-secondary" href="/api/reports/payrolls.xlsx">Excel nóminas</Link><Link className="button-secondary" href="/api/reports/employees.xlsx">Excel empleados</Link></div>}</div>
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Nóminas contables" value={String(paid._count + pending._count)} />
        <Metric label="Empleados únicos" value={String(empleadosUnicos)} />
        {canSeeSalary && <Metric label="Total pagado" value={formatMoney(totalPagado)} />}
        {canSeeSalary && <Metric label="Total pendiente" value={formatMoney(totalPendiente)} />}
        <Metric label="Descuentos" value={formatMoney(totalDescuentos)} />
        {canSeeSalary && <Metric label="Ingresos" value={formatMoney(totalIngresos)} />}
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card"><h2 className="mb-4 font-bold">Por sucursal</h2><div className="space-y-3">{byBranch.map((branch) => <div className="flex justify-between border-b pb-3" key={branch.id}><span><strong>{branch.name}</strong><br /><small className="muted">{uniqueEmployees(branch.payrolls)} empleados · {branch.payrolls.length} nóminas</small></span>{canSeeSalary && <span className="text-right"><strong className="block">{formatMoney(sumNet(branch.payrolls, PAID_STATUSES))}</strong><small className="muted">pendiente {formatMoney(sumNet(branch.payrolls, PENDING_STATUSES))}</small></span>}</div>)}</div></div>
        <div className="card"><h2 className="mb-4 font-bold">Desglose por concepto</h2><div className="space-y-3">{byConcept.map((concept) => <div className="flex justify-between border-b pb-3" key={`${concept.type}-${concept.conceptNameSnapshot}`}><span>{concept.conceptNameSnapshot}<br /><small className="muted">{concept.type === "INCOME" ? "Ingreso" : "Descuento"}</small></span><strong>{formatMoney(concept._sum.totalAmount ?? 0)}</strong></div>)}{!byConcept.length && <p className="muted">Sin movimientos.</p>}</div></div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
