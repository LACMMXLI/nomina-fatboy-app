import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageDriver {
  save(storedName: string, data: Uint8Array): Promise<string>;
  read(storedPath: string): Promise<Buffer>;
}

const configuredRoot = process.env.UPLOAD_DIR;
const root =
  configuredRoot && path.isAbsolute(configuredRoot)
    ? path.normalize(configuredRoot)
    : path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");

function safePath(name: string) {
  const resolved = path.resolve(root, name);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Ruta de archivo no válida.");
  return resolved;
}

export const localStorage: StorageDriver = {
  async save(storedName, data) {
    await mkdir(root, { recursive: true });
    const target = safePath(storedName);
    await writeFile(target, data, { flag: "wx" });
    return target;
  },
  read(storedPath) {
    return readFile(safePath(path.basename(storedPath)));
  },
};
