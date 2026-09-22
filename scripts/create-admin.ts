import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return undefined;
}

function usageError(message: string): never {
  console.error(message);
  console.error(
    "Uso: npm run db:create-admin -- --username admin --email admin@dominio.com " +
      "--password 'algo-seguro-min-12' --firstName Nombre --lastName Apellido [--role SUPER_ADMIN]",
  );
  process.exit(1);
}

async function main() {
  const username = readFlag("username")?.trim().toLowerCase();
  const email = readFlag("email")?.trim().toLowerCase();
  const password = readFlag("password");
  const firstName = readFlag("firstName");
  const lastName = readFlag("lastName");
  const roleInput = readFlag("role")?.trim().toUpperCase() ?? "SUPER_ADMIN";

  if (!username || !email || !password || !firstName || !lastName) {
    usageError("Faltan argumentos obligatorios.");
  }
  if (password.length < 12) {
    usageError("La contraseña debe tener al menos 12 caracteres.");
  }
  if (!Object.values(Role).includes(roleInput as Role)) {
    usageError(`Rol inválido. Usa uno de: ${Object.values(Role).join(", ")}`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL no está configurada.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    const passwordHash = await hash(password, 12);
    const user = await db.user.upsert({
      where: { username },
      update: { email, firstName, lastName, role: roleInput as Role, isActive: true, passwordHash },
      create: {
        username,
        email,
        firstName,
        lastName,
        role: roleInput as Role,
        passwordHash,
        preference: { create: {} },
      },
    });

    const branches = await db.branch.findMany({ select: { id: true } });
    if (branches.length > 0) {
      await db.userBranch.createMany({
        data: branches.map((branch) => ({ userId: user.id, branchId: branch.id })),
        skipDuplicates: true,
      });
    }

    console.log(`Usuario "${user.username}" (${user.role}) listo.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
