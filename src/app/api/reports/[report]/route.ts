import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { periodicityLabel, statusLabel } from "@/lib/labels";
import { branchAndFilters, requireUser } from "@/server/auth";
import { reportWhere, splitReportNet, summarize } from "@/server/reporting";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const user = await requireUser("exports:create");
  const branchWhere = { AND: branchAndFilters(user) };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nómina Fatboy";
  workbook.created = new Date();
  if (report === "payrolls.xlsx") {
    // Misma condición unificada que las pantallas: el Excel no puede diferir.
    const rows = await db.payroll.findMany({
      where: reportWhere(user),
      orderBy: { createdAt: "desc" },
    });
    const totals = summarize(rows);
    const sheet = workbook.addWorksheet("Nóminas");
    sheet.columns = [
      { header: "Folio", key: "folio", width: 20 },
      { header: "Empleado", key: "employee", width: 32 },
      { header: "Número", key: "number", width: 14 },
      { header: "Sucursal", key: "branch", width: 18 },
      { header: "Periodo", key: "period", width: 24 },
      { header: "Ingresos", key: "income", width: 15 },
      { header: "Descuentos", key: "deductions", width: 15 },
      { header: "Pagado", key: "paid", width: 15 },
      { header: "Pendiente", key: "pending", width: 15 },
      { header: "Estado", key: "status", width: 16 },
    ];
    rows.forEach((row) => {
      const net = splitReportNet(row);
      sheet.addRow({
        folio: row.folio,
        employee: row.employeeNameSnapshot,
        number: row.employeeNumberSnapshot,
        branch: row.branchNameSnapshot,
        period: row.periodNameSnapshot,
        income: Number(row.totalIncome),
        deductions: Number(row.totalDeductions),
        paid: Number(net.pagado),
        pending: Number(net.pendiente),
        status: statusLabel(row.status),
      });
    });
    for (const column of ["F", "G", "H", "I"]) sheet.getColumn(column).numFmt = '"$"#,##0.00';
    // Los totales se escriben ya calculados por `summarize`, no como fórmula,
    // para que el archivo muestre exactamente la misma cifra que las pantallas.
    const totalsRow = sheet.addRow({
      employee: `TOTALES · ${totals.empleados} empleados únicos · ${totals.nominas} nóminas`,
      income: Number(totals.ingresos),
      deductions: Number(totals.descuentos),
      paid: Number(totals.pagado),
      pending: Number(totals.pendiente),
    });
    totalsRow.font = { bold: true };
    sheet.autoFilter = `A1:J${sheet.rowCount}`;
  } else if (report === "employees.xlsx") {
    const rows = await db.employee.findMany({ where: branchWhere, include: { branch: true, position: true }, orderBy: { lastName: "asc" } });
    const sheet = workbook.addWorksheet("Empleados");
    sheet.columns = [
      { header: "Número", key: "number", width: 14 },
      { header: "Nombre", key: "name", width: 32 },
      { header: "Sucursal", key: "branch", width: 18 },
      { header: "Puesto", key: "position", width: 22 },
      { header: "Sueldo", key: "salary", width: 15 },
      { header: "Periodicidad", key: "periodicity", width: 16 },
      { header: "Estado", key: "status", width: 12 },
    ];
    rows.forEach((row) => sheet.addRow({ number: row.employeeNumber, name: `${row.firstName} ${row.lastName} ${row.secondLastName ?? ""}`.trim(), branch: row.branch.name, position: row.position.name, salary: Number(row.baseSalary), periodicity: periodicityLabel(row.salaryPeriodicity), status: row.isActive ? "Activo" : "Inactivo" }));
    sheet.getColumn("E").numFmt = '"$"#,##0.00';
    sheet.autoFilter = `A1:G${sheet.rowCount}`;
  } else return Response.json({ error: "Reporte no encontrado." }, { status: 404 });
  const sheet = workbook.worksheets[0];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  await db.auditLog.create({ data: { userId: user.id, action: "EXPORT_EXCEL", entityType: "Report", entityId: report } });
  return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${report}"`, "Cache-Control": "private, no-store" } });
}
