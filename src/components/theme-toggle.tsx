"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="secondary"
      className="h-9 w-9 px-0"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Se dibujan los dos iconos y el CSS decide cuál se ve. Si se eligiera en
          JavaScript, el servidor (que no conoce el tema) pintaría uno distinto al
          del navegador y React avisaría de un desajuste de hidratación. */}
      <Sun size={17} className="hidden dark:block" />
      <Moon size={17} className="block dark:hidden" />
    </Button>
  );
}
