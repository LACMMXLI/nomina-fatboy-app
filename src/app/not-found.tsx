import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center p-5"><section className="card text-center"><h1 className="text-2xl font-bold">Registro no encontrado</h1><p className="muted my-4">El recurso solicitado no existe o ya no está disponible.</p><Link className="button-primary" href="/dashboard">Volver al inicio</Link></section></main>;
}
