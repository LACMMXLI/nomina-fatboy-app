import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { paymentMethodLabel } from "@/lib/labels";
import type { ReceiptSnapshot } from "@/lib/receipt";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  center: { textAlign: "center" },
  section: { marginTop: 12, paddingTop: 7, borderTop: "1 solid #555" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  total: { flexDirection: "row", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginTop: 10, paddingTop: 8, borderTop: "2 solid #111" },
  stamp: { border: "4 solid #111", fontSize: 24, fontWeight: 700, textAlign: "center", padding: 12, marginVertical: 10 },
  small: { fontSize: 7, textAlign: "center", marginTop: 12 },
  logo: { maxWidth: 120, maxHeight: 55, alignSelf: "center", marginBottom: 6 },
  qr: { width: 90, height: 90, alignSelf: "center", marginTop: 12 },
});

export function ReceiptPdf({ receipt, verificationUrl, qrDataUrl, logoUrl, status }: { receipt: ReceiptSnapshot; verificationUrl: string; qrDataUrl?: string; logoUrl?: string; status: string }) {
  const income = receipt.items.filter((item) => item.type === "INCOME");
  const deductions = receipt.items.filter((item) => item.type === "DEDUCTION");
  return (
    <Document title={`${receipt.receiptNumber} - ${receipt.employeeName}`}>
      <Page size="LETTER" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {logoUrl && <Image style={styles.logo} src={logoUrl} />}
        <Text style={styles.title}>{receipt.settings.businessName}</Text>
        <Text style={styles.center}>RECIBO INTERNO DE NÓMINA</Text>
        <Text style={styles.center}>{receipt.branchName}</Text>
        {["CANCELLED", "REPLACED"].includes(status) && <Text style={styles.stamp}>{status === "CANCELLED" ? "CANCELADO" : "REEMPLAZADO"}</Text>}
        <View style={styles.section}>
          <Row label="Recibo" value={`${receipt.receiptNumber} · versión ${receipt.version}`} />
          <Row label="Nómina" value={receipt.payrollFolio} />
          <Row label="Empleado" value={`${receipt.employeeName} · ${receipt.employeeNumber}`} />
          <Row label="Puesto" value={receipt.positionName} />
          <Row label="Periodo" value={receipt.periodName} />
          <Row label="Forma de pago" value={paymentMethodLabel(receipt.paymentMethod)} />
        </View>
        <View style={styles.section}>
          <Text>INGRESOS</Text>
          <Row label="Sueldo base" value={`$${Number(receipt.baseSalary).toFixed(2)}`} />
          {income.map((item) => <Row key={item.code} label={item.name} value={`$${Number(item.totalAmount).toFixed(2)}`} />)}
          <Row label="Total ingresos" value={`$${Number(receipt.totalIncome).toFixed(2)}`} />
        </View>
        <View style={styles.section}>
          <Text>DESCUENTOS</Text>
          {deductions.map((item) => <Row key={item.code} label={item.name} value={`$${Number(item.totalAmount).toFixed(2)}`} />)}
          <Row label="Total descuentos" value={`$${Number(receipt.totalDeductions).toFixed(2)}`} />
        </View>
        <View style={styles.total}><Text>TOTAL A PAGAR</Text><Text>${Number(receipt.netPay).toFixed(2)} MXN</Text></View>
        {Number(receipt.pendingBalance) > 0 && <Text style={styles.stamp}>PAGO NO COMPLETO · SALDO ${Number(receipt.pendingBalance).toFixed(2)}</Text>}
        {receipt.notes && <Text style={{ marginTop: 12 }}>Observaciones: {receipt.notes}</Text>}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {receipt.settings.showQr && qrDataUrl && <Image style={styles.qr} src={qrDataUrl} />}
        <Text style={styles.small}>{receipt.settings.legalLegend}</Text>
        <Text style={styles.small}>Validación: {verificationUrl}</Text>
      </Page>
    </Document>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text>{label}</Text><Text>{value}</Text></View>;
}
