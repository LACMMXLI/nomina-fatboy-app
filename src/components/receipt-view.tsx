import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/labels";
import type { ReceiptSnapshot } from "@/lib/receipt";
import Image from "next/image";

export function ReceiptView({
  receipt,
  verificationUrl,
  qrDataUrl,
  status,
}: {
  receipt: ReceiptSnapshot;
  verificationUrl: string;
  qrDataUrl?: string;
  status: string;
}) {
  const income = receipt.items.filter((item) => item.type === "INCOME");
  const deductions = receipt.items.filter((item) => item.type === "DEDUCTION");
  return (
    <article className="print-receipt card mx-auto max-w-[80mm] text-sm" style={{ "--receipt-width": "80mm" } as React.CSSProperties}>
      <div className="text-center">
        {receipt.settings.logoUrl ? <Image src={receipt.settings.logoUrl} width={160} height={64} unoptimized alt="Logotipo oficial" className="mx-auto mb-2 max-h-16 max-w-40 object-contain" /> : <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-lg bg-black text-lg font-black text-white">F</div>}
        <h1 className="text-xl font-black">{receipt.settings.businessName}</h1>
        <p>{receipt.branchName}</p>
        {receipt.settings.address && <p className="text-xs">{receipt.settings.address}</p>}
        <p className="mt-3 font-bold">RECIBO DE NÓMINA</p>
        {["CANCELLED", "REPLACED"].includes(status) && <p className="my-2 border-4 border-black p-2 text-xl font-black">{status === "CANCELLED" ? "CANCELADO" : "REEMPLAZADO"}</p>}
      </div>
      <hr className="my-3 border-dashed" />
      <Info label="Recibo" value={`${receipt.receiptNumber} · v${receipt.version}`} />
      <Info label="Nómina" value={receipt.payrollFolio} />
      <Info label="Emisión" value={formatDateTime(receipt.generatedAt)} />
      <Info label="Periodo" value={`${receipt.periodName} (${formatDate(receipt.periodStart)}–${formatDate(receipt.periodEnd)})`} />
      <Info label="Empleado" value={`${receipt.employeeName} · ${receipt.employeeNumber}`} />
      <Info label="Puesto" value={receipt.positionName} />
      <Info label="Pago" value={paymentMethodLabel(receipt.paymentMethod)} />
      <hr className="my-3 border-dashed" />
      <h2 className="mb-2 font-bold">INGRESOS</h2>
      <Line name="Sueldo base" amount={receipt.baseSalary} />
      {income.map((item) => <Line key={item.code} name={item.name} amount={item.totalAmount} />)}
      <p className="mt-2 flex justify-between font-bold"><span>Total ingresos</span><span>{formatMoney(receipt.totalIncome)}</span></p>
      <hr className="my-3 border-dashed" />
      <h2 className="mb-2 font-bold">DESCUENTOS</h2>
      {deductions.map((item) => <Line key={item.code} name={item.name} amount={item.totalAmount} />)}
      {!deductions.length && <p>Sin descuentos</p>}
      <p className="mt-2 flex justify-between font-bold"><span>Total descuentos</span><span>{formatMoney(receipt.totalDeductions)}</span></p>
      <hr className="my-3 border-dashed" />
      <div className="flex items-end justify-between gap-3"><span className="font-bold">TOTAL A PAGAR</span><span className="text-2xl font-black">{formatMoney(receipt.netPay)}</span></div>
      {Number(receipt.pendingBalance) > 0 && <p className="mt-2 border-2 border-black p-2 font-bold">PAGO NO COMPLETO. Saldo pendiente: {formatMoney(receipt.pendingBalance)}</p>}
      {receipt.notes && <p className="mt-3"><strong>Observaciones:</strong> {receipt.notes}</p>}
      {(receipt.settings.showEmployeeSignature || receipt.settings.showManagerSignature) && <div className="mt-12 grid grid-cols-2 gap-5 text-center text-xs">{receipt.settings.showEmployeeSignature && <div className="border-t pt-1">Firma empleado</div>}{receipt.settings.showManagerSignature && <div className="border-t pt-1">Firma encargado</div>}</div>}
      {receipt.settings.showQr && <div className="mt-5 break-all text-center text-[10px]">{qrDataUrl && <Image src={qrDataUrl} width={112} height={112} unoptimized alt="Código QR de validación" className="mx-auto h-28 w-28" />}<p className="font-bold">Validación interna</p><p>{verificationUrl}</p></div>}
      <p className="mt-5 text-center text-[10px]">{receipt.settings.legalLegend}</p>
      {receipt.settings.receiptFooter && <p className="mt-2 text-center text-[10px]">{receipt.settings.receiptFooter}</p>}
      <p className="mt-2 text-center text-[10px]">Generó: {receipt.generatedBy}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p className="mb-1"><strong>{label}:</strong> {value}</p>;
}

function Line({ name, amount }: { name: string; amount: string }) {
  return <p className="flex justify-between gap-3"><span>{name}</span><span>{formatMoney(amount)}</span></p>;
}
