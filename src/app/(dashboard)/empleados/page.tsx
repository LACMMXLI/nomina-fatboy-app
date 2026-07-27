import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { branchAndFilters, requireUser } from "@/server/auth";

export const metadata = { title: "Empleados" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; status?: string; page?: string }>;
}) {
  const user = await requireUser("reports:view");
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);
  const take = 20;
  const where = {
    // El alcance del usuario y la sucursal del filtro se acumulan con AND:
    // el parámetro de la URL solo puede restringir, nunca ampliar.
    AND: branchAndFilters(user, params.branch),
    ...(params.status === "inactive" ? { isActive: false } : params.status === "all" ? {} : { isActive: true }),
    ...(params.q
      ? {
          OR: [
            { employeeNumber: { contains: params.q, mode: "insensitive" as const } },
            { firstName: { contains: params.q, mode: "insensitive" as const } },
            { lastName: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [employees, count, branches] = await Promise.all([
    db.employee.findMany({
      where,
      include: { branch: true, position: true, payrolls: { take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
      take,
      skip: (page - 1) * take,
    }),
    db.employee.count({ where }),
    db.branch.findMany({ where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Empleados</h1><p className="muted text-sm">{count} resultado(s)</p></div>
        {["SUPER_ADMIN", "ADMINISTRADOR"].includes(user.role) && <Link className="button-primary" href="/empleados/nuevo">Nuevo empleado</Link>}
      </div>
      <form className="card mb-4 grid gap-3 md:grid-cols-[1fr_220px_160px_auto]">
        <input className="input" name="q" defaultValue={params.q} placeholder="Nombre o número…" />
        <select className="input" name="branch" defaultValue={params.branch ?? ""}><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <select className="input" name="status" defaultValue={params.status ?? ""}><option value="">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select>
        <button className="button-secondary">Filtrar</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Número</th><th>Nombre</th><th>Puesto</th><th>Sucursal</th>{canSeeSalary && <th>Sueldo</th>}<th>Ingreso</th><th>Estado</th>{canSeeSalary && <th>Último pago</th>}</tr></thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td><Link className="font-semibold text-red-600" href={`/empleados/${employee.id}`}>{employee.employeeNumber}</Link></td>
                <td>{employee.firstName} {employee.lastName} {employee.secondLastName}</td>
                <td>{employee.position.name}</td><td>{employee.branch.name}</td>
                {canSeeSalary && <td>{formatMoney(employee.baseSalary)}</td>}
                <td>{formatDate(employee.hireDate)}</td>
                <td><Badge value={employee.isActive ? "PAID" : "CANCELLED"}>{employee.isActive ? "Activo" : "Inactivo"}</Badge></td>
                {canSeeSalary && <td>{employee.payrolls[0] ? formatMoney(employee.payrolls[0].netPay) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!employees.length && <p className="muted p-12 text-center">No hay empleados con esos filtros.</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {page > 1 && <Link className="button-secondary" href={{ query: { ...params, page: page - 1 } }}>Anterior</Link>}
        {page * take < count && <Link className="button-secondary" href={{ query: { ...params, page: page + 1 } }}>Siguiente</Link>}
      </div>
    </>
  );
}
