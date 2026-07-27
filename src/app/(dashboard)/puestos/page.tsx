import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { db } from "@/lib/db";
import { createPositionAction } from "@/server/actions";
import { requireUser } from "@/server/auth";

export default async function PositionsPage() {
  await requireUser("settings:manage");
  const positions = await db.position.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } });
  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="page-header">
        <div><h1 className="page-title">Puestos</h1><p className="muted text-sm">Catálogo laboral editable.</p></div>
        <Modal trigger="Agregar puesto" title="Nuevo puesto">
          <form action={createPositionAction} className="space-y-3">
            <div><label className="label" htmlFor="code">Código</label><input className="input" id="code" name="code" required /></div>
            <div><label className="label" htmlFor="name">Nombre</label><input className="input" id="name" name="name" required /></div>
            <div><label className="label" htmlFor="description">Descripción</label><input className="input" id="description" name="description" /></div>
            <SubmitButton className="w-full">Agregar puesto</SubmitButton>
          </form>
        </Modal>
      </div>
      <div className="table-wrap scroll-area min-h-0 flex-1"><table className="data-table"><thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th><th>Empleados</th><th>Estado</th></tr></thead><tbody>{positions.map((position) => <tr key={position.id}><td>{position.code}</td><td className="font-semibold">{position.name}</td><td>{position.description || "—"}</td><td>{position._count.employees}</td><td><Badge value={position.isActive ? "PAID" : "CANCELLED"}>{position.isActive ? "Activo" : "Inactivo"}</Badge></td></tr>)}</tbody></table></div>
    </div>
  );
}
