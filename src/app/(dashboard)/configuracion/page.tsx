import { LogoUpload } from "@/components/logo-upload";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { printSizeLabel } from "@/lib/labels";
import { updateSettingsAction } from "@/server/actions";
import { requireUser } from "@/server/auth";
import Image from "next/image";

export default async function SettingsPage() {
  await requireUser("settings:manage");
  const settings = await db.systemSettings.findUniqueOrThrow({ where: { id: "default" } });
  return (
    <>
      <div className="page-header"><div><h1 className="page-title">Configuración</h1><p className="muted text-sm">Negocio, apariencia, nómina, impresión y seguridad.</p></div></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <form action={updateSettingsAction} className="card space-y-6">
          <section><h2 className="mb-4 font-bold">Negocio</h2><div className="form-grid"><Field label="Nombre del negocio" name="businessName" defaultValue={settings.businessName} required /><Field label="Dirección general" name="address" defaultValue={settings.address ?? ""} /><Field label="Teléfono" name="phone" defaultValue={settings.phone ?? ""} /><Field label="Zona horaria" name="timezone" defaultValue={settings.timezone} required /></div></section>
          <section><h2 className="mb-4 font-bold">Apariencia</h2><div className="grid gap-4 sm:grid-cols-3"><Color label="Principal" name="primaryColor" value={settings.primaryColor} /><Color label="Secundario" name="secondaryColor" value={settings.secondaryColor} /><Color label="Acento" name="accentColor" value={settings.accentColor} /></div></section>
          <section><h2 className="mb-4 font-bold">Ticket</h2><div className="space-y-4"><div><label className="label" htmlFor="legalLegend">Leyenda legal</label><textarea className="textarea" id="legalLegend" name="legalLegend" defaultValue={settings.legalLegend} required /></div><div><label className="label" htmlFor="receiptFooter">Texto inferior</label><textarea className="textarea" id="receiptFooter" name="receiptFooter" defaultValue={settings.receiptFooter ?? ""} /></div><div className="grid gap-3 sm:grid-cols-2">{[
            ["showEmployeeSignature", "Mostrar firma del empleado", settings.showEmployeeSignature],
            ["showManagerSignature", "Mostrar firma del encargado", settings.showManagerSignature],
            ["showQr", "Mostrar validación QR", settings.showQr],
            ["allowNegativeTotal", "Permitir total negativo", settings.allowNegativeTotal],
            ["requireNegativeApproval", "Autorizar total negativo", settings.requireNegativeApproval],
            ["requireCancellationPassword", "Contraseña para cancelar", settings.requireCancellationPassword],
          ].map(([name, label, checked]) => <label className="flex items-center gap-2 text-sm" key={String(name)}><input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} />{String(label)}</label>)}</div></div></section>
          <SubmitButton>Guardar configuración</SubmitButton>
        </form>
        <aside className="space-y-5">
          <div className="card"><h2 className="mb-4 font-bold">Logotipo</h2>{settings.logoUrl ? <Image src={settings.logoUrl} width={240} height={112} unoptimized className="mb-4 max-h-28 max-w-full object-contain" alt="Logotipo oficial cargado" /> : <p className="muted mb-4 text-sm">No hay logotipo cargado; se muestra el nombre Fatboy.</p>}<LogoUpload /></div>
          <div className="card"><h2 className="mb-3 font-bold">Respaldos</h2><p className="muted text-sm">La restauración no está expuesta en la interfaz. Utiliza comandos autenticados en el servidor:</p><code className="mt-3 block overflow-x-auto rounded bg-black p-3 text-xs text-white">npm run db:backup{"\n"}npm run db:backups{"\n"}npm run db:restore -- archivo.dump --confirm</code></div>
          <div className="card"><h2 className="mb-2 font-bold">Sistema</h2><p className="text-sm">Versión {process.env.APP_VERSION ?? "en desarrollo"}<br />Moneda: {settings.currency}<br />Impresión: {printSizeLabel(settings.defaultPrintSize)}</p></div>
        </aside>
      </div>
    </>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = String(props.name);
  return <div><label className="label" htmlFor={id}>{label}</label><input className="input" id={id} {...props} /></div>;
}

function Color({ label, name, value }: { label: string; name: string; value: string }) {
  return <label className="label">{label}<input className="input mt-1 p-1" type="color" name={name} defaultValue={value} /></label>;
}
