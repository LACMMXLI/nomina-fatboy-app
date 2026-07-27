"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Table2, Zap } from "lucide-react";

const modes = [
  { href: "/nominas/kiosco", label: "Por empleado", icon: Zap, hint: "Adelantos y descuentos sueltos" },
  { href: "/nominas/captura-rapida", label: "Tabla del periodo", icon: Table2, hint: "Todos los empleados a la vez" },
  { href: "/nominas/captura", label: "Detallada", icon: Calculator, hint: "Días, faltas y horas extra" },
] as const;

/**
 * Los tres modos de captura son la misma tarea vista de tres formas.
 * Se muestran como pestañas para no obligar a volver al menú lateral.
 */
export function CaptureTabs({ periodId }: { periodId?: string }) {
  const pathname = usePathname();
  const query = periodId ? `?periodId=${periodId}` : "";
  return (
    <div className="segmented no-print mb-5 max-w-full overflow-x-auto">
      {modes.map(({ href, label, icon: Icon, hint }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href === "/nominas/kiosco" ? href : `${href}${query}`}
            className="segmented-item shrink-0"
            data-active={active}
            aria-current={active ? "page" : undefined}
            title={hint}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
