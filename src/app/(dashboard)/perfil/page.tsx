import { notFound } from "next/navigation";
import { UserProfileForm } from "@/components/user-profile-form";
import { db } from "@/lib/db";
import { canManageUser } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const actor = await requireUser();
  const targetId = (await searchParams).userId ?? actor.id;
  if (!canManageUser(actor.role, actor.id, targetId)) notFound();
  const administrativeEdit = actor.role === "SUPER_ADMIN" && actor.id !== targetId;
  const [profile, branches] = await Promise.all([
    db.user.findUnique({
      where: { id: targetId },
      include: { branches: { select: { branchId: true } } },
    }),
    administrativeEdit ? db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : [],
  ]);
  if (!profile) notFound();
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">{administrativeEdit ? `Editar ${profile.firstName} ${profile.lastName}` : "Mi perfil"}</h1><p className="muted text-sm">Los cambios se guardan en PostgreSQL y quedan registrados en auditoría.</p></div></div>
      <UserProfileForm
        administrativeEdit={administrativeEdit}
        branches={branches}
        profile={{
          id: profile.id,
          updatedAt: profile.updatedAt.toISOString(),
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          username: profile.username,
          role: profile.role,
          isActive: profile.isActive,
          branchIds: profile.branches.map((branch) => branch.branchId),
        }}
      />
    </>
  );
}
