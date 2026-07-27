import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export default async function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const period = await db.payrollPeriod.findUnique({
    where: { id },
    include: { branch: true, payrolls: { orderBy: { employeeNameSnapshot: "asc" } } },
  });
  if (!period) notFound();
  if (period.branchId) await requireUser("reports:view", period.branchId);
  const employeeWhere = {
    isActive: true,
    ...(period.branchId
      ? { branchId: period.branchId }
      : user.role === "SUPER_ADMIN"
        ? {}
        : { branchId: { in: user.branchIds } }),
  };
  const employees = await db.employee.findMany({ where: employeeWhere, include: { branch: true, position: true }, orderBy: { lastName: "asc" } });
  const captured = new Set(period.payrolls.map((payroll) => payroll.employeeId));
  return (
    <>
      <div className="page-header">
        <div><p className="muted text-sm">{period.folio}</p><h1 className="page-title">{period.name}</h1><p className="muted text-sm">{formatDate(period.startDate)} – {formatDate(period.endDate)} · Pago {formatDate(period.paymentDate)}</p></div>
        <div className="flex items-center gap-2"><Badge value={period.status} /><Link className="button-primary" href={`/nominas/captura-rapida?periodId=${period.id}`}>Captura rápida</Link></div>
      </div>
      <section className="mb-5 grid gap-4 sm:grid-cols-4">
        <Metric label="Empleados incluidos" value={String(employees.length)} />
        <Metric label="Sin captura" value={String(employees.length - captured.size)} />
        <Metric label="Finalizados" value={String(period.payrolls.filter((p) => ["FINALIZED", "PAID"].includes(p.status)).length)} />
        {canSeeSalary && <Metric label="Total" value={formatMoney(period.payrolls.reduce((sum, payroll) => sum + Number(payroll.netPay), 0))} />}
      </section>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Empleado</th><th>Sucursal</th>{canSeeSalary && <th>Sueldo</th>}<th>Estado</th>{canSeeSalary && <th>Total</th>}<th>Acción</th></tr></thead><tbody>
        {employees.map((employee) => {
          const payroll = period.payrolls.find((candidate) => candidate.employeeId === employee.id);
          return <tr key={employee.id}><td>{employee.firstName} {employee.lastName}<br /><small className="muted">{employee.employeeNumber} · {employee.position.name}</small></td><td>{employee.branch.name}</td>{canSeeSalary && <td>{formatMoney(employee.baseSalary)}</td>}<td>{payroll ? <Badge value={payroll.status} /> : <span className="muted">Sin captura</span>}</td>{canSeeSalary && <td>{payroll ? formatMoney(payroll.netPay) : "—"}</td>}<td><Link className="text-sm font-semibold text-red-600" href={payroll ? `/nominas/${payroll.id}` : `/nominas/captura?periodId=${period.id}&employeeId=${employee.id}`}>{payroll ? "Abrir" : "Capturar"}</Link></td></tr>;
        })}
      </tbody></table></div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
