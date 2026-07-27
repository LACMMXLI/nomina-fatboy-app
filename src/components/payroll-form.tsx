"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { toast } from "sonner";
import { savePayrollAction } from "@/server/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney, formatSalary } from "@/lib/format";

interface PayrollFormProps {
  periodId: string;
  employeeId: string;
  payroll?: {
    id: string;
    updatedAt: string;
    daysWorked: string;
    daysPaid: string;
    absences: string;
    delays: string;
    overtimeHours: string;
    paymentMethod: string;
    generalNotes: string;
    items: Array<{ code: string; amount: string }>;
  };
  employee: {
    name: string;
    number: string;
    position: string;
    branch: string;
    /** `null` cuando el rol no tiene `salary:view`: sin él no se puede estimar el neto. */
    baseSalary: string | null;
    baseDays: string;
    calculationMode: "FIXED" | "PRORATED";
  };
}

export function PayrollForm({ periodId, employeeId, payroll, employee }: PayrollFormProps) {
  const [state, action] = useActionState(savePayrollAction, undefined);
  const initial = Object.fromEntries(payroll?.items.map((item) => [item.code, item.amount]) ?? []);
  const [values, setValues] = useState({
    daysPaid: payroll?.daysPaid ?? employee.baseDays,
    bonus: initial.BONUS ?? "0",
    overtimeAmount: initial.OVERTIME ?? "0",
    advance: initial.ADVANCE ?? "0",
    loan: initial.LOAN ?? "0",
    consumption: initial.CONSUMPTION ?? "0",
    otherDeduction: initial.OTHER_DEDUCTION ?? "0",
  });
  const totals = useMemo(() => {
    const deductions = new Decimal(values.advance || 0)
      .add(values.loan || 0)
      .add(values.consumption || 0)
      .add(values.otherDeduction || 0)
      .toDecimalPlaces(2)
      .toNumber();
    // Sin sueldo base no hay forma (ni permiso) de estimar ingresos ni neto.
    if (employee.baseSalary === null) return { income: null, deductions, net: null };
    const base =
      employee.calculationMode === "PRORATED"
        ? new Decimal(employee.baseSalary).div(employee.baseDays).mul(values.daysPaid || 0)
        : new Decimal(employee.baseSalary);
    const income = base.add(values.bonus || 0).add(values.overtimeAmount || 0);
    return {
      income: income.toDecimalPlaces(2).toNumber(),
      deductions,
      net: income.sub(deductions).toDecimalPlaces(2).toNumber(),
    };
  }, [employee, values]);

  useEffect(() => {
    if (state?.ok && state.data && typeof state.data === "object" && "id" in state.data) {
      toast.success("Borrador actualizado.");
      window.location.assign(`/nominas/${state.data.id}`);
    } else if (state?.conflict) toast.error(state.error);
  }, [state]);

  function moneyField(name: keyof typeof values, label: string) {
    return (
      <div>
        <label className="label" htmlFor={name}>{label}</label>
        <input
          className="input text-right"
          id={name}
          name={name}
          type="number"
          min="0"
          step="0.01"
          value={values[name]}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        />
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      {payroll && <><input type="hidden" name="payrollId" value={payroll.id} /><input type="hidden" name="updatedAt" value={payroll.updatedAt} /></>}
      <div className="space-y-5">
        <section className="card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Empleado" value={employee.name} />
            <Summary label="Número" value={employee.number} />
            <Summary label="Puesto" value={employee.position} />
            <Summary label="Sucursal" value={employee.branch} />
          </div>
        </section>
        <section className="card">
          <h2 className="mb-4 font-bold">Información del periodo</h2>
          <div className="form-grid lg:grid-cols-4">
            <Input label="Días base" name="baseDaysView" value={employee.baseDays} readOnly />
            <Input label="Días laborados" name="daysWorked" defaultValue={payroll?.daysWorked ?? employee.baseDays} type="number" min="0" step="0.5" />
            <div>
              <label className="label" htmlFor="daysPaid">Días pagados</label>
              <input className="input" id="daysPaid" name="daysPaid" type="number" min="0" step="0.5" value={values.daysPaid} onChange={(event) => setValues((current) => ({ ...current, daysPaid: event.target.value }))} />
            </div>
            <Input label="Faltas" name="absences" defaultValue={payroll?.absences ?? "0"} type="number" min="0" step="0.5" />
            <Input label="Retardos" name="delays" defaultValue={payroll?.delays ?? "0"} type="number" min="0" step="1" />
            <Input label="Horas extra" name="overtimeHours" defaultValue={payroll?.overtimeHours ?? "0"} type="number" min="0" step="0.5" />
            <div>
              <label className="label" htmlFor="paymentMethod">Forma de pago</label>
              <select className="input" id="paymentMethod" name="paymentMethod" defaultValue={payroll?.paymentMethod ?? "CASH"}>
                <option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="MIXED">Mixto</option><option value="OTHER">Otro</option>
              </select>
            </div>
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-income">Ingresos</h2>
              <span className="money text-sm font-semibold text-income">{formatSalary(totals.income)}</span>
            </div>
            <div className="space-y-3">
              {employee.baseSalary !== null && <Summary label="Sueldo base" value={formatMoney(employee.baseSalary)} />}
              {moneyField("bonus", "Bono")}
              {moneyField("overtimeAmount", "Importe horas extra")}
            </div>
          </div>
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-deduction">Descuentos</h2>
              <span className="money text-sm font-semibold text-deduction">{totals.deductions > 0 ? `− ${formatMoney(totals.deductions)}` : formatMoney(0)}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {moneyField("advance", "Adelantos")}
              {moneyField("loan", "Préstamos")}
              {moneyField("consumption", "Consumos")}
              {moneyField("otherDeduction", "Otros descuentos")}
            </div>
          </div>
        </section>
        <section className="card">
          <label className="label" htmlFor="generalNotes">Observaciones generales</label>
          <textarea className="textarea" id="generalNotes" name="generalNotes" defaultValue={payroll?.generalNotes} />
        </section>
      </div>
      <aside className="card h-fit xl:sticky xl:top-24">
        <p className="muted text-sm">Vista previa</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          {totals.income !== null && (
            <div className="flex items-center justify-between">
              <dt className="muted">Total ingresos</dt>
              <dd className="money font-semibold text-income">{formatMoney(totals.income)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="muted">Total descuentos</dt>
            <dd className="money font-semibold text-deduction">{totals.deductions > 0 ? `− ${formatMoney(totals.deductions)}` : formatMoney(0)}</dd>
          </div>
        </dl>
        <div className="mt-3 border-t pt-3">
          <p className="muted text-xs font-medium uppercase tracking-wide">
            {totals.net === null ? "Descuentos capturados" : "Total a pagar"}
          </p>
          <p className="money mt-1 text-4xl font-black" aria-live="polite">
            {totals.net === null ? formatMoney(totals.deductions) : formatMoney(totals.net)}
          </p>
        </div>
        <p className="muted mt-2 text-xs">El servidor recalculará el importe antes de guardar.</p>
        {state?.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <SubmitButton>Guardar borrador</SubmitButton>
          <button className="button-secondary" type="button" onClick={() => window.history.back()}>Volver</button>
        </div>
      </aside>
    </form>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = String(props.name);
  return <div><label className="label" htmlFor={id}>{label}</label><input className="input" id={id} {...props} /></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><p className="muted text-xs font-medium uppercase">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
