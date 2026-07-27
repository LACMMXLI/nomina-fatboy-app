"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  trigger,
  title,
  description,
  children,
  triggerClassName = "button-primary",
  closeOnSubmit = true,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  triggerClassName?: string;
  closeOnSubmit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={triggerClassName}>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal-content"
          aria-describedby={undefined}
          onSubmit={closeOnSubmit ? () => setOpen(false) : undefined}
        >
          <div className={cn("mb-4 flex items-start justify-between gap-4", description && "mb-3")}>
            <div>
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              {description && <Dialog.Description className="muted mt-0.5 text-sm">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              className="-mr-1 -mt-1 rounded-md p-1.5 transition hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
              aria-label="Cerrar"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
