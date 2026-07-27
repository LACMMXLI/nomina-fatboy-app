"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";

/** Cambia de periodo sin volver al listado. */
export function PeriodSwitcher({
  periods,
  current,
  basePath,
}: {
  periods: Array<{ id: string; name: string; folio: string }>;
  current: string;
  basePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (periods.length < 2) return null;
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Periodo</span>
      {pending && <LoaderCircle size={15} className="animate-spin" style={{ color: "var(--muted)" }} />}
      <select
        className="input w-auto"
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(() => router.push(`${basePath}?periodId=${next}`));
        }}
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>{period.name} · {period.folio}</option>
        ))}
      </select>
    </label>
  );
}
