"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createEmployeeAction } from "@/server/actions";
import { SubmitButton } from "@/components/submit-button";

interface Option {
  id: string;
  name: string;
}

export function EmployeeForm({ branches, positions }: { branches: Option[]; positions: Option[] }) {
  const [state, action] = useActionState(createEmployeeAction, undefined);
  useEffect(() => {
    if (state?.ok && state.data && typeof state.data === "object" && "id" in state.data) {
      toast.success("Empleado guardado.");
      window.location.assign(`/empleados/${state.data.id}`);
    }
  }, [state]);
  return (
    <form action={action} className="card space-y-5">
      <div className="form-grid">
        <Field label="Número de empleado" name="employeeNumber" error={state?.fieldErrors?.employeeNumber} required />
        <Field label="Nombre" name="firstName" error={state?.fieldErrors?.firstName} required />
        <Field label="Apellido paterno" name="lastName" error={state?.fieldErrors?.lastName} required />
        <Field label="Apellido materno" name="secondLastName" />
        <Select label="Sucursal" name="branchId" options={branches} error={state?.fieldErrors?.branchId} />
        <Select label="Puesto" name="positionId" options={positions} error={state?.fieldErrors?.positionId} />
        <Field label="Fecha de ingreso" name="hireDate" type="date" error={state?.fieldErrors?.hireDate} required />
        <Field label="Sueldo base" name="baseSalary" type="number" step="0.01" min="0" error={state?.fieldErrors?.baseSalary} required />
        <Field label="Días base" name="baseDays" type="number" step="0.5" min="0.5" defaultValue="7" />
        <div>
          <label className="label" htmlFor="salaryPeriodicity">Periodicidad</label>
          <select className="input" id="salaryPeriodicity" name="salaryPeriodicity" defaultValue="WEEKLY">
            <option value="DAILY">Diaria</option><option value="WEEKLY">Semanal</option><option value="BIWEEKLY">Quincenal</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="calculationMode">Modo de cálculo</label>
          <select className="input" id="calculationMode" name="calculationMode" defaultValue="FIXED">
            <option value="FIXED">Fijo</option><option value="PRORATED">Prorrateado</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="paymentMethod">Forma de pago</label>
          <select className="input" id="paymentMethod" name="paymentMethod" defaultValue="CASH">
            <option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="MIXED">Mixto</option><option value="OTHER">Otro</option>
          </select>
        </div>
        <Field label="Teléfono" name="phone" />
        <Field label="Correo" name="email" type="email" error={state?.fieldErrors?.email} />
      </div>
      <div>
        <label className="label" htmlFor="notes">Observaciones</label>
        <textarea className="textarea" id="notes" name="notes" />
      </div>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <SubmitButton>Guardar empleado</SubmitButton>
    </form>
  );
}

function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string[] }) {
  const id = String(props.name);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input className="input" id={id} {...props} aria-invalid={Boolean(error)} />
      {error?.map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}
    </div>
  );
}

function Select({ label, name, options, error }: { label: string; name: string; options: Option[]; error?: string[] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue="" required aria-invalid={Boolean(error)}>
        <option value="" disabled>Seleccionar…</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      {error?.map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}
    </div>
  );
}
