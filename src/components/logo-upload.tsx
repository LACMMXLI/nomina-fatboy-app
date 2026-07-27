"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoUpload() {
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const response = await fetch("/api/uploads", { method: "POST", body: new FormData(event.currentTarget) });
    const body = await response.json();
    setPending(false);
    if (!response.ok) toast.error(body.error ?? "No fue posible cargar el logotipo.");
    else {
      toast.success("Logotipo actualizado.");
      location.reload();
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="fileType" value="LOGO" />
      <div className="min-w-64 flex-1"><label className="label" htmlFor="logo">Logotipo oficial</label><input className="input pt-2" id="logo" name="file" type="file" accept="image/png,image/jpeg,image/webp" required /></div>
      <Button type="submit" disabled={pending}>{pending ? "Cargando…" : "Cargar logotipo"}</Button>
    </form>
  );
}
