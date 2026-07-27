import "dotenv/config";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const action = process.argv[2];
const backupRoot = path.resolve("backups");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL no está configurada.");
const url = new URL(databaseUrl);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const connection = [
  "--host", url.hostname,
  "--port", url.port || "5432",
  "--username", decodeURIComponent(url.username),
  "--dbname", url.pathname.slice(1),
];

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`${command} terminó con código ${result.status}.`);
}

if (action === "backup") {
  mkdirSync(backupRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupRoot, `nomina-fatboy-${stamp}.dump`);
  run("pg_dump", [...connection, "--format=custom", "--file", target]);
  console.log(`Respaldo creado: ${target}`);
} else if (action === "list") {
  mkdirSync(backupRoot, { recursive: true });
  const files = readdirSync(backupRoot).filter((file) => file.endsWith(".dump")).sort().reverse();
  console.log(files.length ? files.join("\n") : "No hay respaldos.");
} else if (action === "restore") {
  const requested = process.argv[3];
  if (!requested || process.argv[4] !== "--confirm") {
    throw new Error("Uso: npm run db:restore -- archivo.dump --confirm");
  }
  const target = path.resolve(backupRoot, path.basename(requested));
  if (!target.startsWith(`${backupRoot}${path.sep}`)) throw new Error("Ruta de respaldo no válida.");
  run("pg_restore", [...connection, "--clean", "--if-exists", "--no-owner", target]);
  console.log(`Respaldo restaurado: ${target}`);
} else {
  throw new Error("Acción válida: backup, list o restore.");
}
