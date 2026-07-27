import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      database: "connected",
      version: process.env.APP_VERSION ?? "development",
      timestamp: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
    });
  } catch {
    return Response.json(
      {
        status: "degraded",
        database: "unavailable",
        version: process.env.APP_VERSION ?? "development",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
