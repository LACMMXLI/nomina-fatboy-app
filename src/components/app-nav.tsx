"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScrollText,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  FileClock,
  Gauge,
  Settings,
  Tags,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CurrentUser } from "@/server/auth";

type Role = CurrentUser["role"];

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /** Prefijo que también marca el enlace como activo (rutas hermanas). */
  match?: string;
}

const OPERATIONS: readonly Role[] = ["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO"];
const EVERYONE: readonly Role[] = ["SUPER_ADMIN", "ADMINISTRADOR", "ENCARGADO", "CONSULTA"];
const ADMINS: readonly Role[] = ["SUPER_ADMIN", "ADMINISTRADOR"];
const ROOT: readonly Role[] = ["SUPER_ADMIN"];

const sections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Operación",
    items: [
      { href: "/dashboard", label: "Inicio", icon: Gauge, roles: EVERYONE },
      // Una sola entrada para toda la nómina; los tres modos de captura viven dentro.
      { href: "/nominas/kiosco", label: "Nómina", icon: Wallet, roles: OPERATIONS, match: "/nominas" },
      { href: "/periodos", label: "Periodos", icon: ClipboardList, roles: EVERYONE },
      { href: "/empleados", label: "Empleados", icon: Users, roles: EVERYONE },
    ],
  },
  {
    title: "Consulta",
    items: [
      { href: "/historial", label: "Historial", icon: FileClock, roles: EVERYONE },
      { href: "/reportes", label: "Reportes", icon: ChartNoAxesCombined, roles: EVERYONE },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/sucursales", label: "Sucursales", icon: Building2, roles: ADMINS },
      { href: "/puestos", label: "Puestos", icon: Tags, roles: ROOT },
      { href: "/conceptos", label: "Conceptos", icon: Tags, roles: ROOT },
      { href: "/usuarios", label: "Usuarios", icon: UserCog, roles: ROOT },
      { href: "/auditoria", label: "Auditoría", icon: ScrollText, roles: ROOT },
      { href: "/configuracion", label: "Configuración", icon: Settings, roles: ROOT },
    ],
  },
  {
    title: "Cuenta",
    items: [{ href: "/perfil", label: "Mi perfil", icon: UserRound, roles: EVERYONE }],
  },
];

export function AppNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal">
      {sections.map((section) => {
        const items = section.items.filter((item) => item.roles.includes(user.role));
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <p className="nav-section">{section.title}</p>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, match }) => {
                const base = match ?? href;
                const active = pathname === base || pathname.startsWith(`${base}/`);
                return (
                  <Link
                    className="nav-link"
                    data-active={active}
                    href={href}
                    key={href}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
