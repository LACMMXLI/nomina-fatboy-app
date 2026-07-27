import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { QuickMovement } from "@/components/quick-movement";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/labels";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, firstBranch] = await Promise.all([
    db.systemSettings.findUnique({ where: { id: "default" } }),
    db.branch.findFirst({
      where: user.role === "SUPER_ADMIN" ? { isActive: true } : { id: { in: user.branchIds }, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canCapture = hasPermission(user.role, "payroll:draft");
  return (
    <div className="min-h-screen lg:grid lg:h-dvh lg:grid-cols-[236px_1fr] lg:overflow-hidden">
      <aside
        className="no-print hidden border-r p-4 lg:block lg:h-dvh lg:overflow-y-auto"
        style={{ background: "var(--card)" }}
      >
        <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-2">
          {settings?.logoUrl ? (
            <Image src={settings.logoUrl} width={38} height={38} unoptimized alt="Logotipo oficial" className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <span
              className="grid h-9 w-9 place-items-center rounded-xl font-black text-white"
              style={{ background: "linear-gradient(140deg, var(--primary), var(--primary-hover))", boxShadow: "var(--shadow-sm)" }}
            >
              F
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-bold leading-tight">{settings?.businessName ?? "Fatboy"}</span>
            <span className="muted block text-[0.7rem] font-medium">Nómina</span>
          </span>
        </Link>
        <AppNav user={user} />
      </aside>
      <div className="min-w-0 lg:flex lg:h-dvh lg:flex-col">
        <header
          className="no-print sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl lg:px-6"
          style={{ background: "color-mix(in srgb, var(--card) 82%, transparent)" }}
        >
          <details className="relative lg:hidden">
            <summary className="button-secondary cursor-pointer list-none">
              <Menu size={17} /> Menú
            </summary>
            <div className="absolute left-0 top-12 max-h-[70vh] w-64 overflow-y-auto rounded-2xl border p-3" style={{ background: "var(--card)", boxShadow: "var(--shadow-lg)" }}>
              <AppNav user={user} />
            </div>
          </details>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-bold">{firstBranch?.name ?? "Todas las sucursales"}</p>
            {process.env.NODE_ENV !== "production" && <p className="text-xs font-medium text-amber-600">Ambiente de desarrollo</p>}
          </div>
          <div className="flex items-center gap-2">
            {canCapture && <QuickMovement showShortcut />}
            <div className="mx-1 hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="muted text-xs">{roleLabel(user.role)}</p>
            </div>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-6">{children}</main>
      </div>
    </div>
  );
}
