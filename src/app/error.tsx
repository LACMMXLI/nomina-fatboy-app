"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[60vh] place-items-center p-5"><section className="card max-w-lg text-center"><h1 className="text-xl font-bold">No fue posible completar la operación</h1><p className="muted my-4">{error.message || "Ocurrió un error inesperado."}</p><Button onClick={reset}>Intentar de nuevo</Button></section></main>;
}
