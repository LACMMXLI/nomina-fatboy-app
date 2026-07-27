"use client";

import { useRef, useState, useTransition } from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { savePayrollAction } from "@/server/actions";
import { formatMoney } from "@/lib/format";

interface Row {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  /** `null` cuando el rol no tiene `salary:view`. */
  baseSalary: string | null;
  baseDays: string;
  calculationMode: "FIXED" | "PRORATED";
  paymentMethod: string;
  payrollId?: string;
  updatedAt?: string;
  daysPaid: string;
  bonus: string;
  overtimeAmount: string;
  advance: string;
  loan: string;
  consumption: string;
  otherDeduction: string;
}

const EDITABLE_FIELDS = ["daysPaid", "bonus", "overtimeAmount", "advance", "loan", "consumption", "otherDeduction", "paymentMethod"] as const;

function signature(row: Row) {
  return EDITABLE_FIELDS.map((field) => row[field] ?? "").join("|");
}

export function QuickCaptureTable({ periodId, initialRows }: { periodId: string; initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [states, setStates] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [, startTransition] = useTransition();
  // Última firma guardada por empleado: evita reenviar al servidor si nada cambió.
  const savedSignatures = useRef<Record<string, string>>(Object.fromEntries(initialRows.map((row) => [row.employeeId, signature(row)])));
  // El servidor manda `null` cuando el rol no puede ver sueldos: se ocultan ambas columnas.
  const salaryHidden = initialRows.some((row) => row.baseSalary === null);

  function update(employeeId: string, field: keyof Row, value: string) {
    setRows((current) => current.map((row) => (row.employeeId === employeeId ? { ...row, [field]: value } : row)));
  }

  function save(row: Row) {
    if (signature(row) === savedSignatures.current[row.employeeId]) return;
    setStates((current) => ({ ...current, [row.employeeId]: "saving" }));
    const data = new FormData();
    Object.entries({
      periodId,
      employeeId: row.employeeId,
      payrollId: row.payrollId ?? "",
      updatedAt: row.updatedAt ?? "",
      daysWorked: row.daysPaid,
      daysPaid: row.daysPaid,
      absences: "0",
      delays: "0",
      overtimeHours: "0",
      paymentMethod: row.paymentMethod,
      generalNotes: "",
      bonus: row.bonus,
      overtimeAmount: row.overtimeAmount,
      advance: row.advance,
      loan: row.loan,
      consumption: row.consumption,
      otherDeduction: row.otherDeduction,
    }).forEach(([key, value]) => data.set(key, value));
    startTransition(async () => {
      const result = await savePayrollAction(undefined, data);
      if (result.ok && result.data && typeof result.data === "object" && "id" in result.data && "updatedAt" in result.data) {
        const saved = result.data as { id: string; updatedAt: string };
        savedSignatures.current[row.employeeId] = signature(row);
        setRows((current) => current.map((candidate) => candidate.employeeId === row.employeeId ? { ...candidate, payrollId: saved.id, updatedAt: saved.updatedAt } : candidate));
        setStates((current) => ({ ...current, [row.employeeId]: "saved" }));
      } else setStates((current) => ({ ...current, [row.employeeId]: "error" }));
    });
  }

  function total(row: Row) {
    if (row.baseSalary === null) return null;
    const base = row.calculationMode === "PRORATED" ? new Decimal(row.baseSalary).div(row.baseDays).mul(row.daysPaid || 0) : new Decimal(row.baseSalary);
    return base.add(row.bonus || 0).add(row.overtimeAmount || 0).sub(row.advance || 0).sub(row.loan || 0).sub(row.consumption || 0).sub(row.otherDeduction || 0).toNumber();
  }

  function navigate(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!["Enter", "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    const inputs = [...document.querySelectorAll<HTMLInputElement>("[data-quick-input]")];
    const index = inputs.indexOf(event.currentTarget);
    const columns = 7;
    const offset = event.key === "ArrowDown" ? columns : event.key === "ArrowUp" ? -columns : event.key === "ArrowLeft" ? -1 : 1;
    const next = inputs[index + offset];
    if (next) {
      event.preventDefault();
      next.focus();
      next.select();
    }
  }

  return (
    <div className="table-wrap">
      <table className="data-table min-w-[1200px]">
        <thead><tr><th>Empleado</th>{!salaryHidden && <th>Sueldo</th>}<th>Días</th><th>Bono</th><th>Horas extra</th><th>Adelantos</th><th>Préstamos</th><th>Consumos</th><th>Otros desc.</th>{!salaryHidden && <th>Total</th>}<th>Guardado</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId}>
              <td className="sticky left-0 min-w-56" style={{ background: "var(--card)" }}><strong>{row.employeeName}</strong><br /><small className="muted">{row.employeeNumber}</small></td>
              {!salaryHidden && <td>{formatMoney(row.baseSalary!)}</td>}
              {(["daysPaid", "bonus", "overtimeAmount", "advance", "loan", "consumption", "otherDeduction"] as const).map((field) => (
                <td key={field}><input data-quick-input className="input money w-24 text-right" type="number" min="0" step={field === "daysPaid" ? "0.5" : "0.01"} value={row[field]} onKeyDown={navigate} onChange={(event) => update(row.employeeId, field, event.target.value)} onBlur={() => save(row)} /></td>
              ))}
              {!salaryHidden && <td className="money font-bold">{formatMoney(total(row)!)}</td>}
              <td>{states[row.employeeId] === "saving" ? <LoaderCircle className="animate-spin" size={17} /> : states[row.employeeId] === "error" ? <TriangleAlert className="text-red-600" size={18} /> : states[row.employeeId] === "saved" ? <Check className="text-green-600" size={18} /> : "—"}</td>
              <td>{row.payrollId && <Link className="font-semibold text-red-600" href={`/nominas/${row.payrollId}`}>Detalle</Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted p-12 text-center">No hay empleados activos para este periodo.</p>}
    </div>
  );
}
