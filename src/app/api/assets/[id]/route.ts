import { db } from "@/lib/db";
import { localStorage } from "@/lib/storage";
import { requireUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await db.fileAsset.findUnique({ where: { id } });
  if (!asset) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  if (!asset.isPublic) await requireUser();
  const data = await localStorage.read(asset.path);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      "Content-Disposition": `inline; filename="${asset.storedName}"`,
      "Cache-Control": asset.isPublic ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
