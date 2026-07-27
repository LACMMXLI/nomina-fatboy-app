import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS, roleLabel } from "@/lib/labels";
import { createUserAction } from "@/server/actions";
import { requireUser } from "@/server/auth";

export default async function UsersPage() {
  await requireUser("users:manage");
  const [users, branches] = await Promise.all([
    db.user.findMany({ include: { branches: { include: { branch: true } } }, orderBy: { lastName: "asc" } }),
    db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Usuarios</h1><p className="muted text-sm">Acceso, roles y sucursales autorizadas.</p></div></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Sucursales</th><th>Último acceso</th><th>Estado</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.firstName} {user.lastName}</strong><br /><small className="muted">@{user.username}</small></td><td>{user.email}</td><td>{roleLabel(user.role)}</td><td>{user.branches.map((item) => item.branch.name).join(", ") || "—"}</td><td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Nunca"}</td><td><Badge value={user.isActive ? "PAID" : "CANCELLED"}>{user.isActive ? "Activo" : "Inactivo"}</Badge></td><td><Link className="button-secondary" href={`/perfil?userId=${user.id}`}>Editar</Link></td></tr>)}</tbody></table></div>
      <form action={createUserAction} className="card mt-5 space-y-4"><h2 className="font-bold">Crear usuario</h2><div className="form-grid lg:grid-cols-3"><input className="input" name="firstName" placeholder="Nombre" required /><input className="input" name="lastName" placeholder="Apellidos" required /><input className="input" name="email" type="email" placeholder="Correo" required /><input className="input" name="username" placeholder="Usuario" required /><input className="input" name="password" type="password" minLength={12} placeholder="Contraseña (12+ caracteres)" required /><select className="input" name="role" defaultValue="CONSULTA">{Object.entries(ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div><fieldset><legend className="label">Sucursales asignadas</legend><div className="flex flex-wrap gap-4">{branches.map((branch) => <label className="flex items-center gap-2 text-sm" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} />{branch.name}</label>)}</div></fieldset><SubmitButton>Crear usuario</SubmitButton></form>
    </>
  );
}
