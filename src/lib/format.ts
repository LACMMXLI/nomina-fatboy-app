const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function formatMoney(value: string | number | { toString(): string }) {
  return money.format(Number(value.toString()));
}

/** Marca visible cuando un importe está reservado a los roles con `salary:view`. */
export const CONFIDENTIAL_AMOUNT = "•  •  •";

/**
 * Importe sensible (sueldo, ingresos, neto). El servidor envía `null` cuando el
 * rol no puede verlo, así el dato nunca llega al navegador: `null` es la censura,
 * no una bandera que el cliente pueda ignorar.
 */
export function formatSalary(value: string | number | { toString(): string } | null | undefined) {
  return value === null || value === undefined ? CONFIDENTIAL_AMOUNT : formatMoney(value);
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Día, mes y año de una fecha de calendario, sin que intervenga la zona horaria.
 *
 * Las columnas `@db.Date` (inicio y fin de periodo, fecha de pago, ingreso del
 * empleado) no tienen hora: Prisma las entrega como medianoche UTC. Si se
 * leyeran con los captadores locales, en cualquier zona al oeste de Greenwich
 * —Tijuana es UTC−7— esa medianoche cae en el día anterior y la fecha se
 * recorrería un día. Por eso se leen siempre en UTC, y si el valor ya viene
 * como texto `AAAA-MM-DD` se toma tal cual, sin construir un `Date`.
 */
function calendarParts(value: Date | string) {
  if (typeof value === "string") {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  const date = value instanceof Date ? value : new Date(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Fecha de calendario: `2026-07-20` siempre se muestra `20/07/2026`. */
export function formatDate(value: Date | string) {
  const { year, month, day } = calendarParts(value);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** Fecha de calendario en formato `AAAA-MM-DD`, para campos `<input type="date">`. */
export function toDateInput(value: Date | string) {
  const { year, month, day } = calendarParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Marca de tiempo real (creación, pago, último acceso). A diferencia de las
 * fechas de calendario, aquí el instante sí importa, y se muestra en UTC para
 * que el resultado no dependa de la zona horaria de la máquina que renderiza.
 */
export function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${formatDate(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
