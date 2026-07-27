export type FolioKind = "PERIOD" | "PAYROLL" | "RECEIPT";

const prefix = {
  PERIOD: "PER",
  PAYROLL: "NOM",
  RECEIPT: "REC",
} satisfies Record<FolioKind, string>;

export function formatFolio(type: FolioKind, year: number, value: number) {
  if (!Number.isInteger(year) || !Number.isInteger(value) || value < 1) {
    throw new Error("Los datos del folio no son válidos.");
  }
  return `${prefix[type]}-${year}-${String(value).padStart(6, "0")}`;
}
