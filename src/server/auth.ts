import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/permissions";

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMINISTRADOR" | "ENCARGADO" | "CONSULTA";
  branchIds: string[];
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.expiresAt < Date.now()) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { branches: { select: { branchId: true } } },
  });
  if (!user?.isActive || user.authVersion !== session.user.authVersion) return null;
  return {
    id: user.id,
    username: user.username,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    branchIds: user.branches.map((branch) => branch.branchId),
  };
}

export async function requireUser(permission?: Permission, branchId?: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (permission && !hasPermission(user.role, permission)) {
    throw new Error("No tienes permiso para realizar esta acción.");
  }
  if (branchId && user.role !== "SUPER_ADMIN" && !user.branchIds.includes(branchId)) {
    throw new Error("No tienes acceso a esta sucursal.");
  }
  return user;
}

export function branchScope(user: CurrentUser) {
  return user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } };
}
