import { statusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  IN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  FINALIZED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  PAID: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  CLOSED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  REPLACED: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
};

export function Badge({ children, value }: { children?: React.ReactNode; value: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusStyles[value] ?? statusStyles.DRAFT)}>
      {children ?? statusLabel(value)}
    </span>
  );
}
