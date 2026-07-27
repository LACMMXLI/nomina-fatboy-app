import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { periodicityLabel, statusLabel } from "@/lib/labels";
import { hasPermission } from "@/lib/permissions";
import { assertBranchAccess, requireUser } from "@/server/auth";
import { toggleEmployeeAction, updateEmployeeSalaryAction } from "@/server/actions";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const { id } = await params;
  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      branch: true,
      position: true,
      salaryHistory: { include: { changedBy: true }, orderBy: { effectiveDate: "desc" } },
      payrolls: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!employee) notFound();
  assertBranchAccess(user, employee.branchId);
  return (
    <>
      <div className="page-header">
        <div><p className="muted text-sm">{employee.employeeNumber}</p><h1 className="page-title">{employee.firstName} {employee.lastName} {employee.secondLastName}</h1><p className="muted text-sm">{employee.position.name} · {employee.branch.name}</p></div>
        <div className="flex gap-2"><Badge value={employee.isActive ? "PAID" : "CANCELLED"}>{employee.isActive ? "Activo" : "Inactivo"}</Badge><Link className="button-primary" href={`/nominas/captura?employeeId=${employee.id}`}>Nueva nómina</Link></div>
      </div>
      <section className="grid gap-4 md:grid-cols-4">
        {canSeeSalary && <Metric label="Sueldo actual" value={formatMoney(employee.baseSalary)} />}
        <Metric label="Periodicidad" value={periodicityLabel(employee.salaryPeriodicity)} />
        <Metric label="Fecha de ingreso" value={formatDate(employee.hireDate)} />
        <Metric label="Recibos" value={String(employee.payrolls.length)} />
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-bold">Historial de nómina</h2>
          <div className="space-y-2">{employee.payrolls.map((payroll) => <Link className="flex justify-between rounded-lg border p-3" href={`/nominas/${payroll.id}`} key={payroll.id}><span>{payroll.folio}<br /><small className="muted">{statusLabel(payroll.status)}</small></span>{canSeeSalary && <strong>{formatMoney(payroll.netPay)}</strong>}</Link>)}{!employee.payrolls.length && <p className="muted">Sin nóminas.</p>}</div>
        </div>
        <div className="space-y-5">
          {/* El historial salarial es el dato más sensible: solo con `salary:view`. */}
          {canSeeSalary && (
            <div className="card">
              <h2 className="mb-4 font-bold">Historial salarial</h2>
              {employee.salaryHistory.map((change) => <div className="mb-3 border-b pb-3" key={change.id}><p><strong>{formatMoney(change.previousSalary)}</strong> → <strong>{formatMoney(change.newSalary)}</strong></p><p className="muted text-xs">{formatDate(change.effectiveDate)} · {change.reason} · {change.changedBy.firstName}</p></div>)}
              {!employee.salaryHistory.length && <p className="muted">Sin cambios de sueldo.</p>}
            </div>
          )}
          {["SUPER_ADMIN", "ADMINISTRADOR"].includes(user.role) && <form action={updateEmployeeSalaryAction} className="card space-y-3"><h2 className="font-bold">Cambiar sueldo</h2><input type="hidden" name="employeeId" value={employee.id} /><input className="input" name="newSalary" type="number" min="0" step="0.01" placeholder="Nuevo sueldo" required /><input className="input" name="effectiveDate" type="date" required /><input className="input" name="reason" placeholder="Motivo" required /><SubmitButton>Guardar cambio</SubmitButton></form>}
          {["SUPER_ADMIN", "ADMINISTRADOR"].includes(user.role) && <form action={toggleEmployeeAction} className="card"><input type="hidden" name="id" value={employee.id} /><SubmitButton variant="secondary">{employee.isActive ? "Desactivar empleado" : "Reactivar empleado"}</SubmitButton></form>}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>;
}
