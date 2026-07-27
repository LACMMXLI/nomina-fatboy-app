import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/lib/db";
import Image from "next/image";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const settings = await db.systemSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="card w-full max-w-md p-8">
        <div className="mb-7 text-center">
          {settings?.logoUrl ? <Image src={settings.logoUrl} width={192} height={80} unoptimized alt="Logotipo oficial" className="mx-auto mb-3 max-h-20 max-w-48 object-contain" /> : <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-red-600 text-xl font-black text-white">F</div>}
          <h1 className="text-2xl font-bold">{settings?.businessName ?? "Fatboy"}</h1>
          <p className="muted mt-1 text-sm">Control interno de nómina</p>
        </div>
        <Suspense fallback={<p>Preparando acceso…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
