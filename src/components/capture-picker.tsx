"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface PickerPeriod {
  id: string;
  name: string;
  folio: string;
  branchId: string | null;
}

interface PickerEmployee {
  id: string;
  name: string;
  number: string;
  position: string;
  branchId: string;
  branchName: string;
  branchColor: string;
  /** `null` cuando el rol no tiene `salary:view`. */
  baseSalary: string | null;
  /** Estado de la nómina del empleado en cada periodo ya capturado. */
  capturedIn: Record<string, string>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Selección de periodo y empleado en una sola pantalla: elegir empleado
 * ya abre la captura, sin pasos intermedios de "cargar" ni recargas.
 */
export function CapturePicker({
  periods,
  employees,
  destination,
}: {
  periods: PickerPeriod[];
  employees: PickerEmployee[];
  /** Ruta destino; recibe periodId y employeeId como parámetros. */
  destination: string;
}) {
  const router = useRouter();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [search, setSearch] = useState("");

  const period = useMemo(() => periods.find((item) => item.id === periodId) ?? null, [periods, periodId]);

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    return employees
      .filter((item) => !period?.branchId || item.branchId === period.branchId)
      .filter((item) => !term || normalize(item.name).includes(term) || normalize(item.number).includes(term));
  }, [employees, period, search]);

  if (!periods.length) {
    return (
      <div className="empty-state">
        <p className="font-semibold">Todavía no hay un periodo abierto.</p>
        <p className="muted text-sm">Crea el periodo de la semana y podrás capturar a todos los empleados.</p>
        <Link className="button-primary" href="/periodos/nuevo">Crear periodo</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <label className="label" htmlFor="periodId">Periodo</label>
          <select className="input" id="periodId" value={periodId} onChange={(event) => setPeriodId(event.target.value)}>
            {periods.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.folio}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="employee-search">Empleado</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              id="employee-search"
              className="input pl-9"
              placeholder="Busca por nombre o número…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && visible.length === 1) {
                  event.preventDefault();
                  router.push(`${destination}?periodId=${periodId}&employeeId=${visible[0].id}`);
                }
              }}
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const status = item.capturedIn[periodId];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(`${destination}?periodId=${periodId}&employeeId=${item.id}`)}
              className="card-interactive flex items-center gap-3"
            >
              <span
                className="avatar h-10 w-10"
                style={{ background: `color-mix(in srgb, ${item.branchColor} 16%, transparent)`, color: item.branchColor }}
              >
                {item.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="muted block truncate text-xs">{item.number} · {item.position} · {item.branchName}</span>
              </span>
              <span className="shrink-0 text-right">
                {item.baseSalary !== null && <span className="money block text-sm font-bold">{formatMoney(item.baseSalary)}</span>}
                {status && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-income">
                    <Check size={12} /> capturado
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {!visible.length && <p className="muted col-span-full py-12 text-center">No hay empleados que coincidan.</p>}
      </div>
    </div>
  );
}
