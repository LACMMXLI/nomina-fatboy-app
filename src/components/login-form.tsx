"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      identifier: data.get("identifier"),
      password: data.get("password"),
      remember: data.get("remember") === "on" ? "true" : "false",
      redirect: false,
    });
    setPending(false);
    if (!result?.ok) {
      setError("Credenciales incorrectas o cuenta bloqueada temporalmente.");
      return;
    }
    window.location.assign(searchParams.get("callbackUrl") || "/dashboard");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="identifier">Correo electrónico o usuario</label>
        <input className="input" id="identifier" name="identifier" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="remember" type="checkbox" />
        Recordar sesión por 30 días
      </label>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
