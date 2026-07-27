import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export default async function ReportsPage() {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const canExport = hasPermission(user.role, "exports:create");
  const where = user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } };
  const [summary, byBranch, byConcept] = await Promise.all([
    db.payroll.aggregate({ where, _count: true, _sum: { totalIncome: true, totalDeductions: true, netPay: true } }),
    db.branch.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }, include: { payrolls: { where, select: { netPay: true, status: true } } }, orderBy: { name: "asc" } }),
    db.payrollItem.groupBy({ by: ["conceptNameSnapshot", "type"], where: { payroll: where }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 15 }),
  ]);
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Reportes</h1><p className="muted text-sm">Consolidado de nómina por sucursal y concepto.</p></div>{canExport && <div className="flex gap-2"><Link className="button-secondary" href="/api/reports/payrolls.xlsx">Excel nóminas</Link><Link className="button-secondary" href="/api/reports/employees.xlsx">Excel empleados</Link></div>}</div>
      <section className="grid gap-4 md:grid-cols-4"><Metric label="Nóminas" value={String(summary._count)} />{canSeeSalary && <Metric label="Ingresos" value={formatMoney(summary._sum.totalIncome ?? 0)} />}<Metric label="Descuentos" value={formatMoney(summary._sum.totalDeductions ?? 0)} />{canSeeSalary && <Metric label="Neto" value={formatMoney(summary._sum.netPay ?? 0)} />}</section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card"><h2 className="mb-4 font-bold">Por sucursal</h2><div className="space-y-3">{byBranch.map((branch) => <div className="flex justify-between border-b pb-3" key={branch.id}><span><strong>{branch.name}</strong><br /><small className="muted">{branch.payrolls.length} nóminas</small></span>{canSeeSalary && <strong>{formatMoney(branch.payrolls.reduce((sum, payroll) => sum + Number(payroll.netPay), 0))}</strong>}</div>)}</div></div>
        <div className="card"><h2 className="mb-4 font-bold">Desglose por concepto</h2><div className="space-y-3">{byConcept.map((concept) => <div className="flex justify-between border-b pb-3" key={`${concept.type}-${concept.conceptNameSnapshot}`}><span>{concept.conceptNameSnapshot}<br /><small className="muted">{concept.type === "INCOME" ? "Ingreso" : "Descuento"}</small></span><strong>{formatMoney(concept._sum.totalAmount ?? 0)}</strong></div>)}{!byConcept.length && <p className="muted">Sin movimientos.</p>}</div></div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
