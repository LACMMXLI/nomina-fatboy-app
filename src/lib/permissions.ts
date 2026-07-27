import type { Role } from "@/generated/prisma/client";

export const permissions = {
  "users:manage": ["SUPER_ADMIN"],
  "settings:manage": ["SUPER_ADMIN"],
  "audit:view": ["SUPER_ADMIN"],
  "employees:manage": ["SUPER_ADMIN", "ADMINISTRADOR"],
  "periods:manage": ["SUPER_ADMIN", "ADMINISTRADOR"],
  "payroll:draft": ["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO"],
  "payroll:finalize": ["SUPER_ADMIN", "ADMINISTRADOR"],
  "payroll:cancel": ["SUPER_ADMIN"],
  // Sueldos base, ingresos y netos. Los importes de los movimientos que un
  // encargado captura (adelantos, consumos, faltas) NO dependen de este permiso.
  "salary:view": ["SUPER_ADMIN", "ADMINISTRADOR"],
  "reports:view": ["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO", "CONSULTA"],
  "exports:create": ["SUPER_ADMIN", "ADMINISTRADOR"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export function hasPermission(role: Role, permission: Permission) {
  return permissions[permission].includes(role as never);
}

export function canManageUser(role: Role, actorId: string, targetId: string) {
  return actorId === targetId || hasPermission(role, "users:manage");
}
