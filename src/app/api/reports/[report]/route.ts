import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { periodicityLabel, statusLabel } from "@/lib/labels";
import { requireUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const user = await requireUser("exports:create");
  const branchWhere = user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nómina Fatboy";
  workbook.created = new Date();
  if (report === "payrolls.xlsx") {
    const rows = await db.payroll.findMany({ where: branchWhere, orderBy: { createdAt: "desc" } });
    const sheet = workbook.addWorksheet("Nóminas");
    sheet.columns = [
      { header: "Folio", key: "folio", width: 20 },
      { header: "Empleado", key: "employee", width: 32 },
      { header: "Número", key: "number", width: 14 },
      { header: "Sucursal", key: "branch", width: 18 },
      { header: "Periodo", key: "period", width: 24 },
      { header: "Ingresos", key: "income", width: 15 },
      { header: "Descuentos", key: "deductions", width: 15 },
      { header: "Total", key: "net", width: 15 },
      { header: "Estado", key: "status", width: 16 },
    ];
    rows.forEach((row) => sheet.addRow({ folio: row.folio, employee: row.employeeNameSnapshot, number: row.employeeNumberSnapshot, branch: row.branchNameSnapshot, period: row.periodNameSnapshot, income: Number(row.totalIncome), deductions: Number(row.totalDeductions), net: Number(row.netPay), status: statusLabel(row.status) }));
    for (const column of ["F", "G", "H"]) sheet.getColumn(column).numFmt = '"$"#,##0.00';
    const totals = sheet.addRow({ employee: "TOTALES", income: { formula: `SUM(F2:F${sheet.rowCount})` }, deductions: { formula: `SUM(G2:G${sheet.rowCount})` }, net: { formula: `SUM(H2:H${sheet.rowCount})` } });
    totals.font = { bold: true };
    sheet.autoFilter = `A1:I${sheet.rowCount}`;
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
