import Link from "next/link";
import {
  ArrowRight,
  BanknoteArrowUp,
  CalendarPlus,
  Clock3,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardChart } from "@/components/dashboard-chart";
import { QuickMovement } from "@/components/quick-movement";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const user = await requireUser("reports:view");
  const branchFilter = user.role === "SUPER_ADMIN" ? {} : { branchId: { in: user.branchIds } };
  const [paid, pending, employeeCount, draftCount, recent, branches, openPeriod] = await Promise.all([
    db.payroll.aggregate({ where: { ...branchFilter, status: "PAID" }, _sum: { netPay: true } }),
    db.payroll.aggregate({ where: { ...branchFilter, status: "FINALIZED" }, _sum: { netPay: true } }),
    db.employee.count({ where: { ...branchFilter, isActive: true } }),
    db.payroll.count({ where: { ...branchFilter, status: { in: ["DRAFT", "IN_REVIEW"] } } }),
    db.payroll.findMany({
      where: branchFilter,
      take: 6,
      orderBy: { updatedAt: "desc" },
      select: { id: true, folio: true, employeeNameSnapshot: true, netPay: true, status: true, updatedAt: true },
    }),
    db.branch.findMany({
      where: user.role === "SUPER_ADMIN" ? {} : { id: { in: user.branchIds } },
      include: { payrolls: { where: { status: "PAID" }, select: { netPay: true } } },
      orderBy: { name: "asc" },
    }),
    db.payrollPeriod.findFirst({
      where: {
        status: { in: ["DRAFT", "OPEN"] },
        ...(user.role === "SUPER_ADMIN" ? {} : { OR: [{ branchId: null }, { branchId: { in: user.branchIds } }] }),
      },
      orderBy: { startDate: "desc" },
      include: { branch: { select: { name: true } }, payrolls: { select: { id: true } } },
    }),
  ]);

  const chart = branches.map((branch) => ({
    name: branch.name,
    total: branch.payrolls.reduce((sum, payroll) => sum + Number(payroll.netPay), 0),
  }));

  const canSeeSalary = hasPermission(user.role, "salary:view");
  const canCapture = hasPermission(user.role, "payroll:draft");
  const canManagePeriods = hasPermission(user.role, "periods:manage");
  const canManageEmployees = hasPermission(user.role, "employees:manage");

  // Denominador del avance: los empleados que ese periodo debe cubrir.
  const periodTarget = openPeriod?.branchId
    ? await db.employee.count({ where: { isActive: true, branchId: openPeriod.branchId } })
    : employeeCount;
  const periodCaptured = openPeriod?.payrolls.length ?? 0;
  const progress = periodTarget > 0 ? Math.min(100, Math.round((periodCaptured / periodTarget) * 100)) : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{formatDate(new Date())}</p>
          <h1 className="page-title">Hola, {user.name.split(" ")[0]}</h1>
          <p className="muted text-sm">Esto es lo que está pasando con la nómina hoy.</p>
        </div>
      </div>

      {(canCapture || canManagePeriods || canManageEmployees) && (
        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canCapture && (
            <QuickMovement className="card-interactive flex w-full items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(140deg, var(--primary), var(--primary-hover))" }}>
                <Zap size={20} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm font-bold">Registrar movimiento</span>
                <span className="muted block text-xs">Adelanto, consumo, falta o bono</span>
              </span>
            </QuickMovement>
          )}
          {canCapture && <ActionTile href="/nominas/kiosco" icon={Wallet} title="Capturar nómina" hint="Por empleado o en tabla" />}
          {canManagePeriods && <ActionTile href="/periodos/nuevo" icon={CalendarPlus} title="Nuevo periodo" hint="La semana en un clic" />}
          {canManageEmployees && <ActionTile href="/empleados/nuevo" icon={UserPlus} title="Nuevo empleado" hint="Alta rápida" />}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canSeeSalary && <Metric label="Total pagado" value={formatMoney(paid._sum.netPay ?? 0)} icon={BanknoteArrowUp} accent="var(--income)" />}
        {canSeeSalary && <Metric label="Pendiente de pago" value={formatMoney(pending._sum.netPay ?? 0)} icon={Clock3} accent="#f59e0b" />}
        <Metric label="Empleados activos" value={String(employeeCount)} icon={Users} accent="#3b82f6" />
        <Metric
          label="Borradores sin finalizar"
          value={String(draftCount)}
          icon={Wallet}
          accent="var(--primary)"
          href={draftCount > 0 ? "/historial?status=DRAFT" : undefined}
        />
      </section>

      {openPeriod && (
        <section className="card mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Periodo abierto · {openPeriod.branch?.name ?? "Todas las sucursales"}</p>
              <p className="truncate text-lg font-bold">{openPeriod.name}</p>
              <p className="muted text-sm">
                {formatDate(openPeriod.startDate)} – {formatDate(openPeriod.endDate)} · {periodCaptured} de {periodTarget} capturados
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCapture && <Link className="button-primary" href={`/nominas/captura-rapida?periodId=${openPeriod.id}`}>Continuar captura</Link>}
              <Link className="button-secondary" href={`/periodos/${openPeriod.id}`}>Ver detalle</Link>
            </div>
          </div>
          <div className="progress mt-4">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </section>
      )}

      <section className={`mt-5 grid gap-5 ${canSeeSalary ? "xl:grid-cols-[1.4fr_1fr]" : ""}`}>
        {canSeeSalary && (
          <div className="card">
            <h2 className="mb-4 font-bold">Pagado por sucursal</h2>
            <DashboardChart data={chart} />
          </div>
        )}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Actividad reciente</h2>
            <Link className="inline-flex items-center gap-1 text-sm font-semibold text-red-600" href="/historial">
              Ver historial <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((payroll) => (
              <Link
                href={`/nominas/${payroll.id}`}
                key={payroll.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{payroll.employeeNameSnapshot}</p>
                  <p className="muted text-xs">{payroll.folio} · {formatDate(payroll.updatedAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  {canSeeSalary && <p className="money text-sm font-bold">{formatMoney(payroll.netPay)}</p>}
                  <Badge value={payroll.status} />
                </div>
              </Link>
            ))}
            {!recent.length && <p className="muted py-12 text-center">No hay nóminas capturadas.</p>}
          </div>
        </div>
      </section>
    </>
  );
}

function ActionTile({ href, icon: Icon, title, hint }: { href: string; icon: LucideIcon; title: string; hint: string }) {
  return (
    <Link href={href} className="card-interactive flex items-center gap-3">
      <span className="avatar h-11 w-11"><Icon size={20} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="muted block text-xs">{hint}</span>
      </span>
    </Link>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="muted text-sm font-medium">{label}</p>
        <Icon size={17} style={{ color: accent }} />
      </div>
      <p className="stat-value">{value}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="stat-card block transition hover:-translate-y-0.5" style={{ "--stat-accent": accent } as React.CSSProperties}>
        {body}
      </Link>
    );
  }
  return <div className="stat-card" style={{ "--stat-accent": accent } as React.CSSProperties}>{body}</div>;
}
