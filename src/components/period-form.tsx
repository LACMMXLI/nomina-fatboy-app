"use client";

import { useActionState, useEffect, useState } from "react";
import { addDays, endOfMonth, format, startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createPeriodAction } from "@/server/actions";
import { SubmitButton } from "@/components/submit-button";

type PeriodType = "DAILY" | "WEEKLY" | "BIWEEKLY" | "CUSTOM";

interface Draft {
  name: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  paymentDate: string;
}

const iso = (date: Date) => format(date, "yyyy-MM-dd");
const short = (date: Date) => format(date, "d MMM", { locale: es });

/** Lunes de la semana que contiene `date`. */
function weekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function weekPreset(reference: Date, label: string): Draft {
  const start = weekStart(reference);
  const end = addDays(start, 6);
  return {
    name: `${label} ${short(start)} – ${short(end)} ${format(end, "yyyy")}`,
    periodType: "WEEKLY",
    startDate: iso(start),
    endDate: iso(end),
    paymentDate: iso(end),
  };
}

function fortnightPreset(reference: Date): Draft {
  const firstHalf = reference.getDate() <= 15;
  const start = new Date(reference.getFullYear(), reference.getMonth(), firstHalf ? 1 : 16);
  const end = firstHalf ? new Date(reference.getFullYear(), reference.getMonth(), 15) : endOfMonth(reference);
  return {
    name: `${firstHalf ? "1ª" : "2ª"} quincena ${format(reference, "MMMM yyyy", { locale: es })}`,
    periodType: "BIWEEKLY",
    startDate: iso(start),
    endDate: iso(end),
    paymentDate: iso(end),
  };
}

function blankDraft(): Draft {
  return { name: "", periodType: "WEEKLY", startDate: "", endDate: "", paymentDate: "" };
}

export function PeriodForm({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(createPeriodAction, undefined);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok && state.data && typeof state.data === "object" && "id" in state.data) {
      toast.success("Periodo creado y abierto.");
      window.location.assign(`/periodos/${state.data.id}`);
    }
  }, [state]);

  // Los atajos rellenan nombre y fechas; todo sigue siendo editable antes de guardar.
  const presets: Array<{ key: string; label: string; build: () => Draft }> = [
    { key: "actual", label: "Semana actual", build: () => weekPreset(new Date(), "Semana") },
    { key: "pasada", label: "Semana pasada", build: () => weekPreset(subWeeks(new Date(), 1), "Semana") },
    { key: "quincena", label: "Quincena actual", build: () => fortnightPreset(new Date()) },
  ];

  function apply(key: string, build: () => Draft) {
    setDraft(build());
    setApplied(key);
  }

  function field(name: keyof Draft) {
    return {
      value: draft[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setDraft((current) => ({ ...current, [name]: event.target.value }));
        setApplied(null);
      },
    };
  }

  return (
    <form action={action} className="space-y-5">
      <div className="card">
        <p className="label flex items-center gap-1.5"><Sparkles size={13} /> Atajos</p>
        <div className="flex flex-wrap gap-2">
          {presets.map(({ key, label, build }) => (
            <button
              key={key}
              type="button"
              onClick={() => apply(key, build)}
              className="segmented-item border"
              data-active={applied === key}
              style={{ background: applied === key ? "var(--card)" : "var(--card-muted)" }}
            >
              <CalendarRange size={15} />
              {label}
            </button>
          ))}
        </div>
        {applied && (
          <p className="muted mt-3 text-sm">
            Se llenaron nombre y fechas. Revisa y pulsa <strong>Crear y abrir periodo</strong>.
          </p>
        )}
      </div>

      <div className="card space-y-5">
        <div className="form-grid">
          <div>
            <label className="label" htmlFor="name">Nombre del periodo</label>
            <input className="input" id="name" name="name" required {...field("name")} />
            {state?.fieldErrors?.name?.map((message) => <p className="mt-1 text-xs text-red-600" key={message}>{message}</p>)}
          </div>
          <div>
            <label className="label" htmlFor="periodType">Tipo</label>
            <select className="input" id="periodType" name="periodType" {...field("periodType")}>
              <option value="DAILY">Diario</option>
              <option value="WEEKLY">Semanal</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="startDate">Fecha inicial</label>
            <input className="input" id="startDate" name="startDate" type="date" required {...field("startDate")} />
            {state?.fieldErrors?.startDate?.map((message) => <p className="mt-1 text-xs text-red-600" key={message}>{message}</p>)}
          </div>
          <div>
            <label className="label" htmlFor="endDate">Fecha final</label>
            <input className="input" id="endDate" name="endDate" type="date" required {...field("endDate")} />
            {state?.fieldErrors?.endDate?.map((message) => <p className="mt-1 text-xs text-red-600" key={message}>{message}</p>)}
          </div>
          <div>
            <label className="label" htmlFor="paymentDate">Fecha de pago</label>
            <input className="input" id="paymentDate" name="paymentDate" type="date" required {...field("paymentDate")} />
            {state?.fieldErrors?.paymentDate?.map((message) => <p className="mt-1 text-xs text-red-600" key={message}>{message}</p>)}
          </div>
          <div>
            <label className="label" htmlFor="branchId">Sucursal</label>
            <select className="input" id="branchId" name="branchId" defaultValue="">
              <option value="">Todas las sucursales</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="notes">Observaciones</label>
          <textarea className="textarea" id="notes" name="notes" />
        </div>
        {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
        <SubmitButton>Crear y abrir periodo</SubmitButton>
      </div>
    </form>
  );
}
