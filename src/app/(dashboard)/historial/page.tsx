import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/labels";
import { hasPermission } from "@/lib/permissions";
import { branchAndFilters, requireUser } from "@/server/auth";
import { loadReportRows, summarize } from "@/server/reporting";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);
  const take = 25;
  // Filtros de búsqueda de la pantalla, sin criterio financiero propio.
  const search: Prisma.PayrollWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.q ? { OR: [{ folio: { contains: params.q, mode: "insensitive" as const } }, { employeeNameSnapshot: { contains: params.q, mode: "insensitive" as const } }, { employeeNumberSnapshot: { contains: params.q, mode: "insensitive" as const } }] } : {}),
  };
  // El listado muestra todos los estados para poder consultarlos…
  const where = { AND: [...branchAndFilters(user, params.branch), search] };
  const [payrolls, count, branches, rows] = await Promise.all([
    db.payroll.findMany({ where, include: { receipt: true, createdBy: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    db.payroll.count({ where }),
    db.branch.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }, orderBy: { name: "asc" } }),
    // …pero los totales usan la capa unificada sobre los mismos filtros.
    loadReportRows(user, { branchId: params.branch, extra: search }),
  ]);
  const totals = summarize(rows);
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Historial de nómina</h1><p className="muted text-sm">{count} registro(s) · {totals.nominas} contable(s) de {totals.empleados} empleado(s)</p></div>{hasPermission(user.role, "exports:create") && <Link className="button-secondary" href="/api/reports/payrolls.xlsx">Exportar Excel</Link>}</div>
      {canSeeSalary && (
        <section className="mb-4 grid gap-4 sm:grid-cols-3">
          <Metric label="Total pagado" value={formatMoney(totals.pagado)} />
          <Metric label="Total pendiente" value={formatMoney(totals.pendiente)} />
          <Metric label="Descuentos" value={formatMoney(totals.descuentos)} />
        </section>
      )}
      <form className="card mb-4 grid gap-3 md:grid-cols-[1fr_220px_180px_auto_auto]">
        <input className="input" name="q" defaultValue={params.q} placeholder="Folio, empleado o número…" />
        <select className="input" name="branch" defaultValue={params.branch ?? ""}><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <select className="input" name="status" defaultValue={params.status ?? ""}><option value="">Todos los estados</option>{["DRAFT", "IN_REVIEW", "FINALIZED", "PAID", "CANCELLED", "REPLACED"].map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select>
        <button className="button-primary">Filtrar</button><Link className="button-secondary" href="/historial">Limpiar</Link>
      </form>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Folio</th><th>Empleado</th><th>Sucursal</th><th>Periodo</th>{canSeeSalary && <th>Ingresos</th>}<th>Descuentos</th>{canSeeSalary && <th>Total</th>}<th>Estado</th><th>Creó</th></tr></thead><tbody>
        {payrolls.map((payroll) => <tr key={payroll.id}><td><Link className="font-semibold text-red-600" href={`/nominas/${payroll.id}`}>{payroll.folio}<br /><small>{payroll.receipt?.receiptNumber}</small></Link></td><td>{payroll.employeeNameSnapshot}<br /><small className="muted">{payroll.employeeNumberSnapshot}</small></td><td>{payroll.branchNameSnapshot}</td><td>{payroll.periodNameSnapshot}<br /><small className="muted">{formatDate(payroll.periodEndSnapshot)}</small></td>{canSeeSalary && <td>{formatMoney(payroll.totalIncome)}</td>}<td>{formatMoney(payroll.totalDeductions)}</td>{canSeeSalary && <td className="font-bold">{formatMoney(payroll.netPay)}</td>}<td><Badge value={payroll.status} /></td><td>{payroll.createdBy.firstName}</td></tr>)}
      </tbody></table>{!payrolls.length && <p className="muted p-12 text-center">No hay nóminas con esos filtros.</p>}</div>
      <div className="mt-4 flex justify-end gap-2">{page > 1 && <Link className="button-secondary" href={{ query: { ...params, page: page - 1 } }}>Anterior</Link>}{page * take < count && <Link className="button-secondary" href={{ query: { ...params, page: page + 1 } }}>Siguiente</Link>}</div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
