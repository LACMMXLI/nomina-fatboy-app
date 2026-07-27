import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/print-button";
import { ReceiptView } from "@/components/receipt-view";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { receiptSnapshotSchema } from "@/lib/receipt";
import { requireUser } from "@/server/auth";
import { cancelPayrollAction, finalizePayrollAction, markPaidAction, replacePayrollAction } from "@/server/actions";
import QRCode from "qrcode";

export default async function PayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("reports:view");
  // El recibo sí se muestra completo: el encargado está autorizado a reimprimirlo.
  const canSeeSalary = hasPermission(user.role, "salary:view");
  const payroll = await db.payroll.findUnique({
    where: { id },
    include: {
      items: { orderBy: { displayOrder: "asc" } },
      receipt: true,
      payments: { include: { deliveredBy: true }, orderBy: { paidAt: "desc" } },
      previousPayroll: { select: { id: true, folio: true, version: true } },
      replacementPayroll: { select: { id: true, folio: true, version: true } },
      finalizedBy: true,
    },
  });
  if (!payroll) notFound();
  await requireUser("reports:view", payroll.branchId);
  const receipt = payroll.receipt ? receiptSnapshotSchema.parse(payroll.receipt.snapshot) : null;
  const verificationUrl = payroll.receipt ? `${process.env.APP_URL ?? "http://localhost:3000"}/recibo/verificar/${payroll.receipt.verificationToken}` : "";
  const qrDataUrl = receipt?.settings.showQr ? await QRCode.toDataURL(verificationUrl, { margin: 1, width: 220 }) : undefined;
  return (
    <>
      <div className="page-header no-print">
        <div><p className="muted text-sm">{payroll.folio} · versión {payroll.version}</p><h1 className="page-title">{payroll.employeeNameSnapshot}</h1><p className="muted text-sm">{payroll.periodNameSnapshot} · {payroll.branchNameSnapshot}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge value={payroll.status} />{receipt && <><PrintButton /><a className="button-secondary" download href={`/api/receipts/${payroll.id}/pdf`}>Descargar PDF</a></>}</div>
      </div>
      <section className="no-print mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canSeeSalary && <Metric label="Sueldo base" value={formatMoney(payroll.baseSalarySnapshot)} />}
        {canSeeSalary && <Metric label="Ingresos" value={formatMoney(payroll.totalIncome)} />}
        <Metric label="Descuentos" value={formatMoney(payroll.totalDeductions)} />
        {canSeeSalary && <Metric label="Total a pagar" value={formatMoney(payroll.netPay)} strong />}
      </section>
      <section className="no-print mb-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <h2 className="mb-4 font-bold">Desglose</h2>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Tipo</th><th>Concepto</th><th>Cantidad</th><th>Importe</th><th>Total</th></tr></thead><tbody>
            {/* La fila de sueldo base solo existe para quien tiene `salary:view`. */}
            {canSeeSalary && <tr><td>Ingreso</td><td>Sueldo base</td><td>1</td><td>{formatMoney(payroll.baseSalarySnapshot)}</td><td>{formatMoney(payroll.calculationModeSnapshot === "PRORATED" ? Number(payroll.baseSalarySnapshot) / Number(payroll.baseDaysSnapshot) * Number(payroll.daysPaid) : payroll.baseSalarySnapshot)}</td></tr>}
            {payroll.items.map((item) => <tr key={item.id}><td>{item.type === "INCOME" ? "Ingreso" : "Descuento"}</td><td>{item.conceptNameSnapshot}</td><td>{item.quantity.toString()}</td><td>{formatMoney(item.unitAmount)}</td><td>{formatMoney(item.totalAmount)}</td></tr>)}
          </tbody></table></div>
          {payroll.generalNotes && <p className="mt-4 text-sm"><strong>Observaciones:</strong> {payroll.generalNotes}</p>}
          <div className="mt-5 border-t pt-4 text-sm"><p><strong>Creada:</strong> {formatDateTime(payroll.createdAt)}</p>{payroll.finalizedAt && <p><strong>Finalizada:</strong> {formatDateTime(payroll.finalizedAt)} por {payroll.finalizedBy?.firstName}</p>}{payroll.paidAt && <p><strong>Pagada:</strong> {formatDateTime(payroll.paidAt)}</p>}{payroll.cancelledAt && <p><strong>Cancelada:</strong> {formatDateTime(payroll.cancelledAt)} · {payroll.cancellationReason}</p>}</div>
          {(payroll.previousPayroll || payroll.replacementPayroll) && <div className="mt-4 border-t pt-4"><h3 className="font-bold">Versiones relacionadas</h3>{payroll.previousPayroll && <Link className="block text-red-600" href={`/nominas/${payroll.previousPayroll.id}`}>Anterior: {payroll.previousPayroll.folio} v{payroll.previousPayroll.version}</Link>}{payroll.replacementPayroll && <Link className="block text-red-600" href={`/nominas/${payroll.replacementPayroll.id}`}>Reemplazo: {payroll.replacementPayroll.folio} v{payroll.replacementPayroll.version}</Link>}</div>}
        </div>
        <div className="space-y-5">
          {["DRAFT", "IN_REVIEW"].includes(payroll.status) && <>
            <Link className="button-primary w-full" href={`/nominas/captura?periodId=${payroll.periodId}&employeeId=${payroll.employeeId}&payrollId=${payroll.id}`}>Editar borrador</Link>
            {["SUPER_ADMIN", "ADMINISTRADOR"].includes(user.role) && <form action={finalizePayrollAction} className="card space-y-3"><h2 className="font-bold">Finalizar nómina</h2><p className="muted text-sm">Una nómina finalizada no puede editarse; cualquier corrección crea una nueva versión.</p><input type="hidden" name="payrollId" value={payroll.id} /><label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" required />Confirmo que revisé los importes.</label>{payroll.netPay.isNegative() && <textarea className="textarea" name="negativeReason" placeholder="Motivo de autorización del total negativo" required />}<SubmitButton>Finalizar y generar recibo</SubmitButton></form>}
          </>}
          {payroll.status === "FINALIZED" && ["SUPER_ADMIN", "ADMINISTRADOR"].includes(user.role) && <form action={markPaidAction} className="card space-y-3"><h2 className="font-bold">Registrar pago</h2><input type="hidden" name="payrollId" value={payroll.id} /><select className="input" name="paymentMethod" defaultValue={payroll.paymentMethod}><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="MIXED">Mixto</option><option value="OTHER">Otro</option></select><div className="grid grid-cols-3 gap-2"><input className="input" name="cashAmount" type="number" min="0" step="0.01" defaultValue={payroll.paymentMethod === "CASH" ? payroll.netPay.toString() : "0"} placeholder="Efectivo" /><input className="input" name="transferAmount" type="number" min="0" step="0.01" defaultValue={payroll.paymentMethod === "TRANSFER" ? payroll.netPay.toString() : "0"} placeholder="Transferencia" /><input className="input" name="otherAmount" type="number" min="0" step="0.01" defaultValue="0" placeholder="Otro" /></div><input className="input" name="transferReference" placeholder="Referencia opcional" /><input className="input" name="receivedByName" placeholder="Recibido por" required /><textarea className="textarea" name="notes" placeholder="Observación" /><SubmitButton>Marcar como pagada</SubmitButton></form>}
          {user.role === "SUPER_ADMIN" && ["FINALIZED", "PAID"].includes(payroll.status) && <form action={cancelPayrollAction} className="card space-y-3"><h2 className="font-bold text-deduction">Cancelar nómina</h2><input type="hidden" name="payrollId" value={payroll.id} /><textarea className="textarea" name="reason" placeholder="Motivo obligatorio" required /><input className="input" name="password" type="password" placeholder="Tu contraseña" required /><SubmitButton variant="danger">Cancelar conservando historial</SubmitButton></form>}
          {user.role === "SUPER_ADMIN" && ["FINALIZED", "PAID", "CANCELLED"].includes(payroll.status) && <form action={replacePayrollAction} className="card space-y-3"><h2 className="font-bold">Crear reemplazo</h2><input type="hidden" name="payrollId" value={payroll.id} /><input className="input" name="reason" placeholder="Motivo de la corrección" required /><SubmitButton variant="secondary">Copiar a nueva versión</SubmitButton></form>}
        </div>
      </section>
      {receipt && <ReceiptView receipt={receipt} verificationUrl={verificationUrl} qrDataUrl={qrDataUrl} status={payroll.status} />}
    </>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="card"><p className="muted text-sm">{label}</p><p className={strong ? "mt-1 text-3xl font-black text-red-600" : "mt-1 text-xl font-bold"}>{value}</p></div>;
}
