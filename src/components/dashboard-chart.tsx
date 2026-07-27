"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

export function DashboardChart({ data }: { data: Array<{ name: string; total: number }> }) {
  if (!data.length) return <p className="muted py-16 text-center">Aún no hay pagos para graficar.</p>;
  return (
    <div className="h-72" aria-label="Nómina pagada por sucursal">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
          <Tooltip formatter={(value) => formatMoney(Number(value))} />
          <Bar dataKey="total" name="Pagado" fill="#dc2626" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
