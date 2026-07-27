import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABELS, auditActionLabel, auditResultLabel, entityLabel } from "@/lib/labels";
import { requireUser } from "@/server/auth";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string }> }) {
  await requireUser("audit:view");
  const { q, action } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: {
      // La acción se elige de una lista: el usuario ve español y se filtra por el código interno.
      ...(action ? { action } : {}),
      ...(q ? { OR: [{ entityId: { contains: q, mode: "insensitive" as const } }, { reason: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    include: { user: true, branch: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Auditoría</h1><p className="muted text-sm">Registro inmutable desde la interfaz.</p></div></div>
      <form className="card mb-4 grid gap-3 md:grid-cols-[1fr_260px_auto_auto]">
        <input className="input" name="q" defaultValue={q} placeholder="Identificador o motivo…" />
        <select className="input" name="action" defaultValue={action ?? ""}>
          <option value="">Todas las acciones</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <button className="button-primary">Filtrar</button>
        <Link className="button-secondary" href="/auditoria">Limpiar</Link>
      </form>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Sucursal</th><th>Motivo</th><th>Resultado</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td>{log.user ? `${log.user.firstName} ${log.user.lastName}` : "Sistema"}</td><td className="font-semibold">{auditActionLabel(log.action)}</td><td>{entityLabel(log.entityType)}<br /><small className="muted">{log.entityId}</small></td><td>{log.branch?.name ?? "—"}</td><td>{log.reason ?? "—"}</td><td>{auditResultLabel(log.result)}</td></tr>)}</tbody></table>{!logs.length && <p className="muted p-12 text-center">No hay eventos.</p>}</div>
    </>
  );
}
