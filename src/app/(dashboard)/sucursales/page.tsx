import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { EMPTY_TOTALS, loadReportRows, summarizeBy } from "@/server/reporting";
import { createBranchAction } from "@/server/actions";
import { requireUser } from "@/server/auth";

export default async function BranchesPage() {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const branches = await db.branch.findMany({
    where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  });
  // Los totales salen de la capa unificada, no de un filtro propio de la pantalla.
  const byBranch = summarizeBy(await loadReportRows(user), (row) => row.branchId);
  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="page-header">
        <div><h1 className="page-title">Sucursales</h1><p className="muted text-sm">Catálogo editable y totales acumulados.</p></div>
        {user.role === "SUPER_ADMIN" && (
          <Modal trigger="Agregar sucursal" title="Nueva sucursal">
            <form action={createBranchAction} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input" name="code" placeholder="Clave corta" required />
                <input className="input" name="name" placeholder="Nombre" required />
                <input className="input" name="managerName" placeholder="Responsable" />
                <input className="input" name="phone" placeholder="Teléfono" />
                <input className="input sm:col-span-2" name="address" placeholder="Dirección" />
                <label className="flex items-center gap-2 text-sm"><span className="muted">Color</span><input className="h-9 w-16 rounded-md border" name="color" type="color" defaultValue="#dc2626" aria-label="Color identificador" /></label>
              </div>
              <SubmitButton className="w-full">Crear sucursal</SubmitButton>
            </form>
          </Modal>
        )}
      </div>
      <section className="scroll-area min-h-0 flex-1 grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3">{branches.map((branch) => { const totals = byBranch.get(branch.id) ?? EMPTY_TOTALS; return <article className="card" key={branch.id}><div className="flex items-start justify-between"><div><p className="muted text-xs">{branch.code}</p><h2 className="text-xl font-bold">{branch.name}</h2></div><Badge value={branch.isActive ? "PAID" : "CANCELLED"}>{branch.isActive ? "Activa" : "Inactiva"}</Badge></div><p className="muted mt-3 text-sm">{branch.address || "Sin dirección"}<br />{branch.phone || "Sin teléfono"}<br />Responsable: {branch.managerName || "Sin asignar"}</p><div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4"><div><p className="muted text-xs">Empleados</p><strong>{branch._count.employees}</strong></div><div><p className="muted text-xs">Con nómina</p><strong>{totals.empleados}</strong></div>{canSeeSalary && <div><p className="muted text-xs">Total pagado</p><strong>{formatMoney(totals.pagado)}</strong></div>}{canSeeSalary && <div><p className="muted text-xs">Total pendiente</p><strong>{formatMoney(totals.pendiente)}</strong></div>}</div></article>; })}</section>
    </div>
  );
}
