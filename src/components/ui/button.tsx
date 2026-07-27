import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={cn(
        variant === "primary" && "button-primary",
        variant === "secondary" && "button-secondary",
        variant === "danger" && "button bg-red-700 text-white",
        className,
      )}
      {...props}
    />
  );
}
