import { PeriodForm } from "@/components/period-form";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";

export default async function NewPeriodPage() {
  const user = await requireUser("periods:manage");
  const branches = await db.branch.findMany({
    where: { isActive: true, ...(user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return <><div className="page-header"><div><h1 className="page-title">Crear periodo</h1><p className="muted text-sm">El periodo quedará abierto para captura.</p></div></div><PeriodForm branches={branches} /></>;
}
