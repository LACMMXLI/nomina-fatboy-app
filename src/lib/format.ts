import { format } from "date-fns";
import { es } from "date-fns/locale";

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

export function formatDate(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy", { locale: es });
}

export function formatDateTime(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: es });
}
