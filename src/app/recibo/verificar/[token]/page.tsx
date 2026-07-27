import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { receiptSnapshotSchema } from "@/lib/receipt";

export const dynamic = "force-dynamic";

export default async function VerifyReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await db.payrollReceipt.findUnique({ where: { verificationToken: token }, include: { payroll: true } });
  if (!receipt) notFound();
  const snapshot = receiptSnapshotSchema.parse(receipt.snapshot);
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="card w-full max-w-lg">
        <div className="mb-6 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-red-600 font-black text-white">F</div><h1 className="text-2xl font-bold">Validación de recibo</h1><p className="muted text-sm">Información interna mínima</p></div>
        <div className="space-y-3"><Info label="Folio" value={snapshot.receiptNumber} /><Info label="Empleado" value={snapshot.employeeName} /><Info label="Periodo" value={snapshot.periodName} /><Info label="Fecha" value={formatDate(snapshot.generatedAt)} /><Info label="Total" value={formatMoney(snapshot.netPay)} /><div className="flex items-center justify-between"><span className="muted">Estado</span><Badge value={receipt.payroll.status} /></div></div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-3"><span className="muted">{label}</span><strong className="text-right">{value}</strong></div>;
}
