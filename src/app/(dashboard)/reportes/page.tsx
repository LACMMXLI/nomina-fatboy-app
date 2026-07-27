import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { EMPTY_TOTALS, loadReportRows, reportWhere, summarize, summarizeBy } from "@/server/reporting";

export default async function ReportsPage() {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const canExport = hasPermission(user.role, "exports:create");
  const where = reportWhere(user);
  const [rows, branches, byConcept] = await Promise.all([
    loadReportRows(user),
    db.branch.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.payrollItem.groupBy({ by: ["conceptNameSnapshot", "type"], where: { payroll: where }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 15 }),
  ]);
  const totals = summarize(rows);
  const byBranch = summarizeBy(rows, (row) => row.branchId);
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Reportes</h1><p className="muted text-sm">Consolidado de nómina por sucursal y concepto.</p></div>{canExport && <div className="flex gap-2"><Link className="button-secondary" href="/api/reports/payrolls.xlsx">Excel nóminas</Link><Link className="button-secondary" href="/api/reports/employees.xlsx">Excel empleados</Link></div>}</div>
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Nóminas contables" value={String(totals.nominas)} />
        <Metric label="Empleados únicos" value={String(totals.empleados)} />
        {canSeeSalary && <Metric label="Total pagado" value={formatMoney(totals.pagado)} />}
        {canSeeSalary && <Metric label="Total pendiente" value={formatMoney(totals.pendiente)} />}
        <Metric label="Descuentos" value={formatMoney(totals.descuentos)} />
        {canSeeSalary && <Metric label="Ingresos" value={formatMoney(totals.ingresos)} />}
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card"><h2 className="mb-4 font-bold">Por sucursal</h2><div className="space-y-3">{branches.map((branch) => {
          const branchTotals = byBranch.get(branch.id) ?? EMPTY_TOTALS;
          return <div className="flex justify-between border-b pb-3" key={branch.id}><span><strong>{branch.name}</strong><br /><small className="muted">{branchTotals.empleados} empleados · {branchTotals.nominas} nóminas</small></span>{canSeeSalary && <span className="text-right"><strong className="block">{formatMoney(branchTotals.pagado)}</strong><small className="muted">pendiente {formatMoney(branchTotals.pendiente)}</small></span>}</div>;
        })}</div></div>
        <div className="card"><h2 className="mb-4 font-bold">Desglose por concepto</h2><div className="space-y-3">{byConcept.map((concept) => <div className="flex justify-between border-b pb-3" key={`${concept.type}-${concept.conceptNameSnapshot}`}><span>{concept.conceptNameSnapshot}<br /><small className="muted">{concept.type === "INCOME" ? "Ingreso" : "Descuento"}</small></span><strong>{formatMoney(concept._sum.totalAmount ?? 0)}</strong></div>)}{!byConcept.length && <p className="muted">Sin movimientos.</p>}</div></div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
