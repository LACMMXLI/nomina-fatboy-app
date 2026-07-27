import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptPdf } from "@/components/receipt-pdf";
import { db } from "@/lib/db";
import { receiptSnapshotSchema } from "@/lib/receipt";
import { sanitizeFilename } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ payrollId: string }> }) {
  const { payrollId } = await params;
  const user = await requireUser("reports:view");
  const receipt = await db.payrollReceipt.findUnique({
    where: { payrollId },
    include: { payroll: { include: { employee: { select: { branchId: true } } } } },
  });
  if (!receipt) return Response.json({ error: "Recibo no encontrado." }, { status: 404 });
  // La sucursal se valida por la nómina y por el empleado dueño de la misma.
  if (
    user.role !== "SUPER_ADMIN" &&
    (!user.branchIds.includes(receipt.payroll.branchId) ||
      !user.branchIds.includes(receipt.payroll.employee.branchId))
  ) {
    return Response.json({ error: "No tienes acceso a esta sucursal." }, { status: 403 });
  }
  const snapshot = receiptSnapshotSchema.parse(receipt.snapshot);
  const verificationUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/recibo/verificar/${receipt.verificationToken}`;
  const qrDataUrl = snapshot.settings.showQr ? await QRCode.toDataURL(verificationUrl, { margin: 1, width: 240 }) : undefined;
  const logoUrl = snapshot.settings.logoUrl
    ? new URL(snapshot.settings.logoUrl, process.env.APP_URL ?? "http://localhost:3000").toString()
    : undefined;
  const document = createElement(ReceiptPdf, {
    receipt: snapshot,
    verificationUrl,
    qrDataUrl,
    logoUrl,
    status: receipt.payroll.status,
  }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(document);
  await db.$transaction([
    db.auditLog.create({
      data: { userId: user.id, action: "DOWNLOAD_RECEIPT_PDF", entityType: "Payroll", entityId: payrollId, branchId: receipt.payroll.branchId },
    }),
    db.payrollReceipt.update({ where: { id: receipt.id }, data: { pdfPath: `generated:${new Date().toISOString()}` } }),
  ]);
  const filename = sanitizeFilename(`nomina-${receipt.receiptNumber}-${snapshot.employeeName}-${snapshot.periodEnd}.pdf`);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
