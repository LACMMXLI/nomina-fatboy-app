import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ConceptType,
  PrismaClient,
  Role,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no está configurada.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const branches = [
  { code: "VEN", name: "Venecia", color: "#dc2626" },
  { code: "SM", name: "San Marcos", color: "#2563eb" },
  { code: "AME", name: "Américas", color: "#16a34a" },
];

const positions = [
  "Encargado",
  "Caja",
  "Mesero",
  "Cocinero",
  "Sushi",
  "Plancha",
  "Ayudante general",
  "Marisquero",
  "Limpieza",
  "Velador",
  "Otro",
];

const concepts = [
  ["BASE_SALARY", "Sueldo base", ConceptType.INCOME, true],
  ["BONUS", "Bono", ConceptType.INCOME, true],
  ["OVERTIME", "Horas extra", ConceptType.INCOME, true],
  ["COMMISSION", "Comisión", ConceptType.INCOME, false],
  ["OTHER_INCOME", "Otro ingreso", ConceptType.INCOME, true],
  ["ABSENCE", "Falta", ConceptType.DEDUCTION, true],
  ["DELAY", "Retardo", ConceptType.DEDUCTION, false],
  ["ADVANCE", "Adelanto", ConceptType.DEDUCTION, true],
  ["LOAN", "Préstamo", ConceptType.DEDUCTION, true],
  ["CONSUMPTION", "Consumo interno", ConceptType.DEDUCTION, true],
  ["OTHER_DEDUCTION", "Otro descuento", ConceptType.DEDUCTION, true],
] as const;

async function main() {
  for (const branch of branches) {
    await db.branch.upsert({ where: { code: branch.code }, update: branch, create: branch });
  }
  for (const name of positions) {
    const code = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, "_");
    await db.position.upsert({ where: { code }, update: { name }, create: { code, name } });
  }
  for (const [code, name, type, quick] of concepts) {
    await db.payrollConcept.upsert({
      where: { code },
      update: { name, type, showInQuickCapture: quick },
      create: { code, name, type, showInQuickCapture: quick, isDefault: true },
    });
  }
  await db.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      businessName: process.env.BUSINESS_NAME ?? "Fatboy",
      legalLegend:
        "Este documento es un comprobante interno de pago y no sustituye el recibo fiscal de nómina correspondiente.",
      timezone: process.env.TIMEZONE ?? "America/Tijuana",
    },
  });

  // Se normalizan igual que en el alta desde la interfaz, para que el admin
  // inicial pueda entrar sin importar cómo se escribieran las variables.
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !username || !password || password.length < 12) {
    throw new Error("Configura INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_USERNAME e INITIAL_ADMIN_PASSWORD (mínimo 12 caracteres).");
  }
  const passwordHash = await hash(password, 12);
  const user = await db.user.upsert({
    where: { username },
    update: { email, isActive: true },
    create: {
      username,
      email,
      passwordHash,
      firstName: "Administrador",
      lastName: "Fatboy",
      role: Role.SUPER_ADMIN,
      preference: { create: {} },
    },
  });
  const allBranches = await db.branch.findMany({ select: { id: true } });
  await db.userBranch.createMany({
    data: allBranches.map((branch) => ({ userId: user.id, branchId: branch.id })),
    skipDuplicates: true,
  });
}

main()
  .then(() => console.log("Datos iniciales creados correctamente."))
  .finally(() => db.$disconnect());
