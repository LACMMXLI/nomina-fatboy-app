"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, LoaderCircle, Plus, Search, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addMovementAction, loadMovementsAction, quickFinalizeAction, removeMovementAction } from "@/server/actions";
import { formatMoney, formatSalary } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { QuickDraftState } from "@/lib/quick-capture";

interface Concept {
  code: string;
  name: string;
  type: "INCOME" | "DEDUCTION";
}

interface Employee {
  id: string;
  name: string;
  number: string;
  position: string;
  /** `null` cuando el rol no tiene `salary:view`. */
  baseSalary: string | null;
}

interface Branch {
  id: string;
  name: string;
  color: string;
  period: { id: string; name: string; folio: string } | null;
  employees: Employee[];
}

const isCustom = (code: string) => code.startsWith("OTHER_");

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function KioskCapture({
  branches,
  concepts,
  canFinalize,
}: {
  branches: Branch[];
  concepts: Concept[];
  canFinalize: boolean;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(branches.length === 1 ? branches[0].id : null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<QuickDraftState | null>(null);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [amount, setAmount] = useState("");
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  const branch = useMemo(() => branches.find((item) => item.id === branchId) ?? null, [branches, branchId]);
  const employee = useMemo(() => branch?.employees.find((item) => item.id === employeeId) ?? null, [branch, employeeId]);
  const deductions = useMemo(() => concepts.filter((item) => item.type === "DEDUCTION"), [concepts]);
  const incomes = useMemo(() => concepts.filter((item) => item.type === "INCOME"), [concepts]);
  const filteredEmployees = useMemo(() => {
    const term = normalize(search.trim());
    if (!branch) return [];
    if (!term) return branch.employees;
    return branch.employees.filter((item) => normalize(item.name).includes(term) || normalize(item.number).includes(term));
  }, [branch, search]);

  function pickBranch(next: Branch) {
    setBranchId(next.id);
    setEmployeeId(null);
    setDraft(null);
    resetEntry();
  }

  function resetEntry() {
    setConcept(null);
    setAmount("");
    setCustomName("");
    setNote("");
    setConfirmFinalize(false);
  }

  function pickEmployee(next: Employee) {
    if (!branch?.period) return;
    const periodId = branch.period.id;
    setEmployeeId(next.id);
    resetEntry();
    setDraft(null);
    startTransition(async () => {
      const result = (await loadMovementsAction({ periodId, employeeId: next.id })) as ActionResult<QuickDraftState>;
      if (result.ok && result.data) setDraft(result.data);
      else toast.error(result.error ?? "No se pudieron cargar los movimientos.");
    });
  }

  function changeEmployee() {
    setEmployeeId(null);
    setDraft(null);
    resetEntry();
  }

  function pickConcept(next: Concept) {
    setConcept(next);
    setCustomName("");
    setTimeout(() => amountRef.current?.focus(), 0);
  }

  function addMovement() {
    if (!branch?.period || !employee || !concept) return;
    const periodId = branch.period.id;
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
        toast.success(`${concept.name} agregado.`);
        setTimeout(() => amountRef.current?.focus(), 0);
      } else {
        toast.error(result.error ?? "No se pudo agregar el movimiento.");
      }
    });
  }

  function removeMovement(itemId: string) {
    if (!draft?.payrollId) return;
    const payrollId = draft.payrollId;
    startTransition(async () => {
      const result = (await removeMovementAction({ payrollId, itemId })) as ActionResult<QuickDraftState>;
      if (result.ok && result.data) {
        setDraft(result.data);
        toast.success("Movimiento eliminado.");
      } else {
        toast.error(result.error ?? "No se pudo eliminar.");
      }
    });
  }

  function finalize() {
    if (!draft?.payrollId) return;
    const payrollId = draft.payrollId;
    startTransition(async () => {
      const result = await quickFinalizeAction({ payrollId });
      if (result.ok && result.data) {
        toast.success("Nómina finalizada. Su recibo ya está disponible.");
        router.push(`/nominas/${result.data.id}`);
      } else {
        setConfirmFinalize(false);
        toast.error(result.error ?? "No se pudo finalizar la nómina.");
      }
    });
  }

  if (!branches.length) {
    return <div className="empty-state"><p className="muted">No tienes sucursales asignadas.</p></div>;
  }

  // Paso 1: elegir sucursal
  if (!branch) {
    return (
      <div className="fade-in grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((item) => (
          <button key={item.id} type="button" onClick={() => pickBranch(item)} className="card-interactive flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: item.color }}>
              <Store size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{item.name}</span>
              <span className="muted block text-xs">{item.period ? item.period.name : "Sin periodo abierto"}</span>
            </span>
            <span className="ml-auto shrink-0">
              <span className="chip">{item.employees.length}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  // Sucursal sin periodo abierto
  if (!branch.period) {
    return (
      <div className="empty-state fade-in">
        <p className="font-bold">{branch.name}</p>
        <p className="muted text-sm">No hay un periodo de nómina abierto para esta sucursal.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {branches.length > 1 && <button type="button" className="button-secondary" onClick={() => setBranchId(null)}>Cambiar sucursal</button>}
          <Link className="button-primary" href="/periodos/nuevo">Crear periodo</Link>
        </div>
      </div>
    );
  }

  // Paso 2: elegir empleado
  if (!employee) {
    return (
      <div className="fade-in">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: branch.color }}><Store size={18} /></span>
            <div>
              <p className="font-bold leading-tight">{branch.name}</p>
              <p className="muted text-xs">{branch.period.name} · {branch.period.folio}</p>
            </div>
          </div>
          {branches.length > 1 && <button type="button" className="button-secondary" onClick={() => setBranchId(null)}><ArrowLeft size={16} /> Sucursal</button>}
        </div>
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            className="input h-12 pl-9"
            placeholder="Buscar empleado por nombre o número…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filteredEmployees.length === 1) {
                event.preventDefault();
                pickEmployee(filteredEmployees[0]);
              }
            }}
            autoFocus
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredEmployees.map((item) => (
            <button key={item.id} type="button" onClick={() => pickEmployee(item)} className="card-interactive flex items-center gap-3">
              <span className="avatar h-10 w-10">{item.name.charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="muted block truncate text-xs">{item.number} · {item.position}</span>
              </span>
              {item.baseSalary !== null && <span className="money shrink-0 text-sm font-bold">{formatMoney(item.baseSalary)}</span>}
            </button>
          ))}
          {!filteredEmployees.length && <p className="muted col-span-full py-12 text-center">No hay empleados que coincidan.</p>}
        </div>
      </div>
    );
  }

  const finalized = draft?.status === "FINALIZED" || draft?.status === "PAID";
  // El servidor manda `null` cuando el rol no puede ver sueldos.
  const salaryHidden = employee.baseSalary === null;

  // Paso 3: capturar movimientos
  return (
    <div className="fade-in grid gap-5 lg:grid-cols-[1fr_370px]">
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="avatar h-11 w-11 text-lg">{employee.name.charAt(0)}</span>
            <div>
              <p className="font-bold leading-tight">{employee.name}</p>
              <p className="muted text-xs">{employee.number} · {employee.position} · {branch.name}</p>
            </div>
          </div>
          <button type="button" className="button-secondary" onClick={changeEmployee}><ArrowLeft size={16} /> Otro empleado</button>
        </div>

        <div className="card">
          <p className="label mb-2 text-deduction">Descuentos</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {deductions.map((item) => <ConceptButton key={item.code} concept={item} active={concept?.code === item.code} onPick={pickConcept} />)}
          </div>
          {incomes.length > 0 && (
            <>
              <p className="label mb-2 mt-4 text-income">Ingresos</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {incomes.map((item) => <ConceptButton key={item.code} concept={item} active={concept?.code === item.code} onPick={pickConcept} />)}
              </div>
            </>
          )}
        </div>

        <div className="card">
          {concept ? (
            <>
              <p className="mb-3 text-sm">
                Agregar <strong className={concept.type === "DEDUCTION" ? "text-deduction" : "text-income"}>{concept.name}</strong> a {employee.name.split(" ")[0]}
              </p>
              <div className="grid gap-3">
                {isCustom(concept.code) && (
                  <div>
                    <label className="label" htmlFor="kiosk-name">Nombre del movimiento</label>
                    <input id="kiosk-name" className="input" placeholder="Ej. Uniforme, caja, herramienta…" value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={60} />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="label" htmlFor="kiosk-amount">Importe</label>
                    <input
                      ref={amountRef}
                      id="kiosk-amount"
                      className="input input-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addMovement(); } }}
                    />
                  </div>
                  <button type="button" className="button-primary button-lg" onClick={addMovement} disabled={pending}>
                    {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Plus size={18} />} Agregar
                  </button>
                </div>
                <input className="input" placeholder="Nota opcional (referencia, folio…)" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
              </div>
            </>
          ) : (
            <p className="muted py-2 text-center text-sm">Elige un tipo de movimiento para capturar el importe.</p>
          )}
        </div>
      </div>

      <aside className="card h-fit lg:sticky lg:top-4">
        <div className="flex items-center justify-between">
          <p className="label mb-0">Movimientos</p>
          {pending && <LoaderCircle size={15} className="animate-spin" style={{ color: "var(--muted)" }} />}
        </div>
        {!salaryHidden && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="muted">Sueldo base</span>
            <span className="money font-semibold">{formatSalary(draft?.basePay ?? employee.baseSalary)}</span>
          </div>
        )}
        <ul className="mt-2 space-y-1.5">
          {draft?.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name}</span>
                {item.note && <span className="muted block truncate text-xs">{item.note}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`money font-semibold ${item.type === "DEDUCTION" ? "text-deduction" : "text-income"}`}>
                  {item.type === "DEDUCTION" ? "− " : "+ "}{formatMoney(item.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => removeMovement(item.id)}
                  disabled={pending || finalized}
                  className="rounded p-1 transition hover:bg-[color-mix(in_srgb,var(--deduction)_14%,transparent)] disabled:opacity-40"
                  aria-label={`Eliminar ${item.name}`}
                >
                  <Trash2 size={15} style={{ color: "var(--deduction)" }} />
                </button>
              </span>
            </li>
          ))}
          {!draft?.items.length && <li className="muted py-3 text-center text-xs">Aún no hay movimientos.</li>}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
          {!salaryHidden && (
            <div className="flex justify-between">
              <dt className="muted">Total ingresos</dt>
              <dd className="money font-semibold text-income">{formatSalary(draft?.totalIncome ?? employee.baseSalary)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="muted">Total descuentos</dt>
            <dd className="money font-semibold text-deduction">
              {Number(draft?.totalDeductions ?? 0) > 0 ? "− " : ""}{formatMoney(draft?.totalDeductions ?? 0)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 border-t pt-3">
          {/* Sin `salary:view` el total del empleado no se calcula ni se envía. */}
          <p className="label mb-0">{salaryHidden ? "Descuentos capturados" : "Neto a pagar"}</p>
          <p className="money mt-1 text-3xl font-black" aria-live="polite">
            {salaryHidden ? formatMoney(draft?.totalDeductions ?? 0) : formatSalary(draft?.netPay ?? employee.baseSalary)}
          </p>
        </div>

        {draft?.payrollId && (
          <div className="mt-4 space-y-2">
            {canFinalize && !finalized && (
              confirmFinalize ? (
                <div className="rounded-xl border p-3" style={{ background: "var(--card-muted)" }}>
                  <p className="text-sm font-semibold">¿Finalizar la nómina de {employee.name.split(" ")[0]}?</p>
                  <p className="muted mt-0.5 text-xs">Se genera el recibo y ya no podrá editarse; una corrección crea otra versión.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="button-primary flex-1" onClick={finalize} disabled={pending}>
                      {pending ? <LoaderCircle size={16} className="animate-spin" /> : <BadgeCheck size={16} />} Sí, finalizar
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setConfirmFinalize(false)} disabled={pending}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="button-primary w-full" onClick={() => setConfirmFinalize(true)}>
                  <BadgeCheck size={16} /> Finalizar y generar recibo
                </button>
              )
            )}
            <Link className="button-secondary w-full" href={`/nominas/${draft.payrollId}`}>Abrir nómina completa</Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function ConceptButton({ concept, active, onPick }: { concept: Concept; active: boolean; onPick: (concept: Concept) => void }) {
  const color = concept.type === "DEDUCTION" ? "var(--deduction)" : "var(--income)";
  return (
    <button
      type="button"
      onClick={() => onPick(concept)}
      className="rounded-xl border px-3 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
      style={active ? { background: color, color: "#fff", borderColor: color } : { borderColor: "var(--border-strong)", color }}
    >
      {concept.name}
    </button>
  );
}
