import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = connectionString ? describe : describe.skip;
const db = connectionString ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) : null;
const suffix = Date.now().toString();
let userId = "";
let branchId = "";
let positionId = "";
let employeeId = "";
let periodId = "";

suite("flujo de persistencia PostgreSQL", () => {
  beforeAll(async () => {
    const user = await db!.user.create({
      data: { username: `test-${suffix}`, email: `test-${suffix}@example.com`, passwordHash: "test-only", firstName: "Test", lastName: "Runner", role: "SUPER_ADMIN" },
    });
    const branch = await db!.branch.create({ data: { code: `T${suffix.slice(-6)}`, name: `Sucursal ${suffix}` } });
    const position = await db!.position.create({ data: { code: `P${suffix.slice(-6)}`, name: `Puesto ${suffix}` } });
    userId = user.id; branchId = branch.id; positionId = position.id;
  });

  afterAll(async () => {
    if (!db) return;
    if (periodId) await db.payrollPeriod.delete({ where: { id: periodId } });
    if (employeeId) await db.employee.delete({ where: { id: employeeId } });
    await db.position.delete({ where: { id: positionId } });
    await db.branch.delete({ where: { id: branchId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("crea empleado y periodo con relaciones", async () => {
    const employee = await db!.employee.create({
      data: { employeeNumber: `E${suffix}`, firstName: "Ana", lastName: "Prueba", branchId, positionId, hireDate: new Date("2026-07-01"), baseSalary: 3500, baseDays: 7 },
    });
    const period = await db!.payrollPeriod.create({
      data: { folio: `PER-T-${suffix}`, name: "Semana de prueba", startDate: new Date("2026-07-20"), endDate: new Date("2026-07-26"), paymentDate: new Date("2026-07-27"), branchId, status: "OPEN", createdByUserId: userId },
    });
    employeeId = employee.id; periodId = period.id;
    expect((await db!.employee.findUnique({ where: { id: employee.id }, include: { branch: true } }))?.branch.id).toBe(branchId);
    expect(period.status).toBe("OPEN");
  });
});
