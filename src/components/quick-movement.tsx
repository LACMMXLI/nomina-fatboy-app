"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Check, LoaderCircle, Search, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { addMovementAction, loadMovementsAction, quickCaptureDataAction } from "@/server/actions";
import type { QuickCaptureData, QuickDraftState, QuickEmployee } from "@/lib/quick-capture";
import { formatMoney, formatSalary } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

const isCustom = (code: string) => code.startsWith("OTHER_");

/** La plataforma no cambia durante la sesión: no hay nada a lo que suscribirse. */
const subscribeNothing = () => () => {};

/** Orden sugerido: lo que más se captura en el día a día queda primero. */
const PRIORITY = ["ADVANCE", "CONSUMPTION", "ABSENCE", "LOAN", "BONUS", "OVERTIME"];

function byPriority(a: { code: string }, b: { code: string }) {
  const rank = (code: string) => {
    const index = PRIORITY.indexOf(code);
    return index === -1 ? PRIORITY.length : index;
  };
  return rank(a.code) - rank(b.code);
}

/** Búsqueda tolerante a acentos: "perez" encuentra a "Pérez". */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function QuickMovement({
  className = "button-primary",
  children,
  showShortcut = false,
}: {
  className?: string;
  children?: React.ReactNode;
  showShortcut?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<QuickCaptureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<QuickEmployee | null>(null);
  const [draft, setDraft] = useState<QuickDraftState | null>(null);
  const [search, setSearch] = useState("");
  const [conceptCode, setConceptCode] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(0);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);
  // El servidor no conoce la plataforma: se rinde "Ctrl" y el cliente ajusta sin desajustar la hidratación.
  const isMac = useSyncExternalStore(subscribeNothing, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => false);

  // Ctrl/⌘ + K abre el atajo desde cualquier pantalla.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const load = useCallback(() => {
    if (data) return;
    setLoading(true);
    startTransition(async () => {
      const result = await quickCaptureDataAction();
      setLoading(false);
      if (result.ok && result.data) setData(result.data);
      else toast.error(result.error ?? "No se pudo cargar el catálogo.");
    });
  }, [data]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
    else reset();
  }

  function reset() {
    setEmployee(null);
    setDraft(null);
    setSearch("");
    setConceptCode(null);
    setAmount("");
    setCustomName("");
    setNote("");
    setSaved(0);
    if (saved > 0) router.refresh();
  }

  const concept = useMemo(
    () => data?.concepts.find((item) => item.code === conceptCode) ?? null,
    [data, conceptCode],
  );
  // El servidor manda `baseSalary: null` cuando el rol no tiene `salary:view`.
  const salaryHidden = employee !== null && employee.baseSalary === null;

  const matches = useMemo(() => {
    if (!data) return [];
    const term = normalize(search.trim());
    const list = term
      ? data.employees.filter(
          (item) => normalize(item.name).includes(term) || normalize(item.number).includes(term),
        )
      : data.employees;
    return list.slice(0, 40);
  }, [data, search]);

  const deductions = useMemo(() => (data?.concepts ?? []).filter((item) => item.type === "DEDUCTION").sort(byPriority), [data]);
  const incomes = useMemo(() => (data?.concepts ?? []).filter((item) => item.type === "INCOME").sort(byPriority), [data]);

  function pickEmployee(next: QuickEmployee) {
    setEmployee(next);
    setDraft(null);
    setConceptCode(next.periodId ? (PRIORITY.find((code) => data?.concepts.some((item) => item.code === code)) ?? null) : null);
    setAmount("");
    setCustomName("");
    setNote("");
    const periodId = next.periodId;
    if (!periodId) return;
    startTransition(async () => {
      const result = (await loadMovementsAction({ periodId, employeeId: next.id })) as ActionResult<QuickDraftState>;
      if (result.ok && result.data) setDraft(result.data);
      setTimeout(() => amountRef.current?.focus(), 30);
    });
  }

  function save() {
    const periodId = employee?.periodId;
    if (!employee || !periodId || !concept) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Escribe un importe mayor a cero.");
      amountRef.current?.focus();
      return;
    }
    if (isCustom(concept.code) && !customName.trim()) {
      toast.error("Escribe el nombre del movimiento.");
      return;
    }
    startTransition(async () => {
      const result = (await addMovementAction({
        periodId,
        employeeId: employee.id,
        conceptCode: concept.code,
        customName: customName.trim() || undefined,
        amount,
        note: note.trim() || undefined,
      })) as ActionResult<QuickDraftState>;
      if (result.ok && result.data) {
        setDraft(result.data);
        setAmount("");
        setCustomName("");
        setNote("");
        setSaved((current) => current + 1);
        toast.success(`${concept.name} de ${formatMoney(value)} registrado a ${employee.name.split(" ")[0]}.`);
        setTimeout(() => amountRef.current?.focus(), 30);
      } else {
        toast.error(result.error ?? "No se pudo registrar el movimiento.");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger className={className} onMouseEnter={load}>
        {children ?? (
          <>
            <Zap size={16} />
            Movimiento
            {showShortcut && <span className="kbd ml-1 hidden sm:inline-flex">{isMac ? "⌘K" : "Ctrl K"}</span>}
          </>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content" style={{ width: "min(94vw, 620px)" }} aria-describedby={undefined}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-black tracking-tight">Registrar movimiento</Dialog.Title>
              <p className="muted mt-0.5 truncate text-sm">
                {employee ? `${employee.name} · ${employee.branchName}` : "Adelantos, consumos, faltas, bonos…"}
              </p>
            </div>
            <Dialog.Close className="button-ghost -mr-2 -mt-1 h-8 px-2" aria-label="Cerrar"><X size={18} /></Dialog.Close>
          </div>

          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="skeleton h-14 w-full" />
              ))}
            </div>
          )}

          {!loading && data && !employee && (
            <div className="fade-in">
              <div className="relative mb-3">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                <input
                  className="input h-12 pl-9"
                  placeholder="Busca por nombre o número de empleado…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && matches.length === 1) {
                      event.preventDefault();
                      pickEmployee(matches[0]);
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="scroll-area -mx-1 space-y-1.5 px-1" style={{ maxHeight: "22rem" }}>
                {matches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pickEmployee(item)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]"
                  >
                    <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: `color-mix(in srgb, ${item.branchColor} 18%, transparent)`, color: item.branchColor, display: "grid", placeItems: "center", fontWeight: 800 }}>
                      {item.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="muted block truncate text-xs">{item.number} · {item.position} · {item.branchName}</span>
                    </span>
                    {!item.periodId && <span className="chip shrink-0 text-deduction">Sin periodo</span>}
                  </button>
                ))}
                {!matches.length && <p className="muted py-10 text-center text-sm">No hay empleados que coincidan.</p>}
              </div>
            </div>
          )}

          {!loading && employee && !employee.periodId && (
            <div className="empty-state fade-in">
              <p className="font-semibold">No hay un periodo abierto para {employee.branchName}.</p>
              <p className="muted text-sm">Crea el periodo una sola vez y todos los movimientos de la semana caerán ahí.</p>
              <div className="flex gap-2">
                <button type="button" className="button-secondary" onClick={() => setEmployee(null)}><ArrowLeft size={16} /> Volver</button>
                <Link className="button-primary" href="/periodos/nuevo" onClick={() => setOpen(false)}>Crear periodo</Link>
              </div>
            </div>
          )}

          {!loading && employee?.periodId && (
            <div className="fade-in space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" className="button-ghost h-8 px-2" onClick={() => { setEmployee(null); setDraft(null); }}>
                  <ArrowLeft size={16} /> Otro empleado
                </button>
                <span className="chip">{employee.periodName}</span>
              </div>

              <div>
                <p className="label">Tipo de movimiento</p>
                <div className="flex flex-wrap gap-2">
                  {[...deductions, ...incomes].map((item) => {
                    const active = item.code === conceptCode;
                    const color = item.type === "DEDUCTION" ? "var(--deduction)" : "var(--income)";
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => { setConceptCode(item.code); setCustomName(""); setTimeout(() => amountRef.current?.focus(), 0); }}
                        className="rounded-full border px-3.5 py-2 text-sm font-semibold transition"
                        style={active ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "var(--border-strong)", color }}
                      >
                        {item.type === "DEDUCTION" ? "−" : "+"} {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {concept && isCustom(concept.code) && (
                <div>
                  <label className="label" htmlFor="quick-name">Nombre del movimiento</label>
                  <input id="quick-name" className="input" placeholder="Ej. Uniforme, caja, herramienta…" value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={60} />
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="label" htmlFor="quick-amount">Importe</label>
                  <input
                    ref={amountRef}
                    id="quick-amount"
                    className="input input-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }}
                  />
                </div>
                <button type="button" className="button-primary button-lg" onClick={save} disabled={pending || !concept}>
                  {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />} Registrar
                </button>
              </div>

              <input className="input" placeholder="Nota opcional (referencia, folio…)" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />

              <div className="rounded-xl border p-3" style={{ background: "var(--card-muted)" }}>
                <div className="flex items-center justify-between text-sm">
                  {/* Sin `salary:view` se resume lo capturado, no el neto del empleado. */}
                  <span className="muted">{salaryHidden ? "Descuentos capturados" : "Neto de la semana"}</span>
                  <span className="money text-xl font-black">
                    {salaryHidden ? formatMoney(draft?.totalDeductions ?? 0) : formatSalary(draft?.netPay ?? employee.baseSalary)}
                  </span>
                </div>
                {draft && draft.items.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t pt-2 text-xs">
                    {draft.items.slice(-4).map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="truncate">{item.name}</span>
                        <span className={`money font-semibold ${item.type === "DEDUCTION" ? "text-deduction" : "text-income"}`}>
                          {item.type === "DEDUCTION" ? "− " : "+ "}{formatMoney(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {draft?.payrollId && (
                  <Link className="button-secondary mt-3 h-9 w-full" href={`/nominas/${draft.payrollId}`} onClick={() => setOpen(false)}>
                    Abrir nómina completa
                  </Link>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
