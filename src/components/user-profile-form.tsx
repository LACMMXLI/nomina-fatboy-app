"use client";

import { signOut } from "next-auth/react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABELS } from "@/lib/labels";
import { changeUserPasswordAction, updateUserAction } from "@/server/actions";

type Branch = { id: string; name: string };
type Profile = {
  id: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  branchIds: string[];
};

export function UserProfileForm({
  profile,
  branches,
  administrativeEdit,
}: {
  profile: Profile;
  branches: Branch[];
  administrativeEdit: boolean;
}) {
  const [profileState, profileAction] = useActionState(updateUserAction, undefined);
  const [passwordState, passwordAction] = useActionState(changeUserPasswordAction, undefined);

  useEffect(() => {
    if (profileState?.ok) {
      toast.success("Información guardada.");
      window.location.assign(administrativeEdit ? `/perfil?userId=${profile.id}` : "/perfil");
    }
  }, [administrativeEdit, profile.id, profileState]);

  useEffect(() => {
    if (!passwordState?.ok) return;
    const self = Boolean(passwordState.data && typeof passwordState.data === "object" && "self" in passwordState.data && passwordState.data.self);
    if (self) void signOut({ callbackUrl: "/login" });
    else {
      toast.success("Contraseña actualizada.");
      window.location.assign(`/perfil?userId=${profile.id}`);
    }
  }, [passwordState, profile.id]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form action={profileAction} className="card space-y-4">
        <h2 className="font-bold">Información del usuario</h2>
        <input type="hidden" name="userId" value={profile.id} />
        <input type="hidden" name="updatedAt" value={profile.updatedAt} />
        <div className="form-grid">
          <Field label="Nombre" name="firstName" defaultValue={profile.firstName} errors={profileState?.fieldErrors?.firstName} />
          <Field label="Apellidos" name="lastName" defaultValue={profile.lastName} errors={profileState?.fieldErrors?.lastName} />
          <Field label="Correo" name="email" type="email" defaultValue={profile.email} errors={profileState?.fieldErrors?.email} />
          <Field label="Usuario" name="username" defaultValue={profile.username} errors={profileState?.fieldErrors?.username} />
          {administrativeEdit && <div><label className="label" htmlFor="role">Rol</label><select className="input" id="role" name="role" defaultValue={profile.role}>{Object.entries(ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>}
        </div>
        {administrativeEdit && <fieldset><legend className="label">Sucursales asignadas</legend><div className="flex flex-wrap gap-4">{branches.map((branch) => <label className="flex items-center gap-2 text-sm" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked={profile.branchIds.includes(branch.id)} />{branch.name}</label>)}</div></fieldset>}
        {administrativeEdit && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={profile.isActive} />Usuario activo</label>}
        {profileState?.error && <p className="text-sm text-red-600" role="alert">{profileState.error}</p>}
        <SubmitButton>Guardar información</SubmitButton>
      </form>

      <form action={passwordAction} className="card space-y-4">
        <h2 className="font-bold">Cambiar contraseña</h2>
        <p className="muted text-sm">{administrativeEdit ? "Confirma tu contraseña de administrador para asignar una nueva." : "Al guardar se cerrará tu sesión en todos los dispositivos."}</p>
        <input type="hidden" name="userId" value={profile.id} />
        <Field label="Tu contraseña actual" name="currentPassword" type="password" errors={passwordState?.fieldErrors?.currentPassword} />
        <Field label="Nueva contraseña" name="newPassword" type="password" minLength={12} errors={passwordState?.fieldErrors?.newPassword} />
        <Field label="Confirmar nueva contraseña" name="confirmPassword" type="password" minLength={12} errors={passwordState?.fieldErrors?.confirmPassword} />
        {passwordState?.error && <p className="text-sm text-red-600" role="alert">{passwordState.error}</p>}
        <SubmitButton>Cambiar contraseña</SubmitButton>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  minLength,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  minLength?: number;
  errors?: string[];
}) {
  return <div><label className="label" htmlFor={name}>{label}</label><input className="input" id={name} name={name} type={type} defaultValue={defaultValue} minLength={minLength} required />{errors?.map((error) => <p className="mt-1 text-xs text-red-600" key={error}>{error}</p>)}</div>;
}
