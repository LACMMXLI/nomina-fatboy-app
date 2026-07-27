"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="secondary" className="h-9" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut size={16} />
      <span className="hidden sm:inline">Salir</span>
    </Button>
  );
}
