import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { db } from "@/lib/db";
import { createConceptAction } from "@/server/actions";
import { requireUser } from "@/server/auth";

export default async function ConceptsPage() {
  await requireUser("settings:manage");
  const concepts = await db.payrollConcept.findMany({ include: { _count: { select: { items: true } } }, orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="page-header">
        <div><h1 className="page-title">Conceptos de nómina</h1><p className="muted text-sm">Los conceptos utilizados permanecen en el historial.</p></div>
        <Modal trigger="Agregar concepto" title="Nuevo concepto">
          <form action={createConceptAction} className="space-y-3">
            <div><label className="label" htmlFor="code">Código</label><input className="input" id="code" name="code" required /></div>
            <div><label className="label" htmlFor="name">Nombre</label><input className="input" id="name" name="name" required /></div>
            <div><label className="label" htmlFor="type">Tipo</label><select className="input" id="type" name="type"><option value="INCOME">Ingreso</option><option value="DEDUCTION">Descuento</option></select></div>
            <SubmitButton className="w-full">Agregar concepto</SubmitButton>
          </form>
        </Modal>
      </div>
      <div className="table-wrap scroll-area min-h-0 flex-1"><table className="data-table"><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Captura rápida</th><th>Movimientos</th><th>Estado</th></tr></thead><tbody>{concepts.map((concept) => <tr key={concept.id}><td>{concept.code}</td><td className="font-semibold">{concept.name}</td><td>{concept.type === "INCOME" ? "Ingreso" : "Descuento"}</td><td>{concept.showInQuickCapture ? "Sí" : "No"}</td><td>{concept._count.items}</td><td><Badge value={concept.isActive ? "PAID" : "CANCELLED"}>{concept.isActive ? "Activo" : "Inactivo"}</Badge></td></tr>)}</tbody></table></div>
    </div>
  );
}
