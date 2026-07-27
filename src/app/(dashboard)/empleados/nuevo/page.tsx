import { EmployeeForm } from "@/components/employee-form";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Nuevo empleado" };

export default async function NewEmployeePage() {
  const user = await requireUser("employees:manage");
  const [branches, positions] = await Promise.all([
    db.branch.findMany({ where: { isActive: true, ...(user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.position.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <><div className="page-header"><div><h1 className="page-title">Alta de empleado</h1><p className="muted text-sm">Captura los datos laborales iniciales.</p></div></div><EmployeeForm branches={branches} positions={positions} /></>;
}
