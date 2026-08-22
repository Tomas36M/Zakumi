"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/admin/ui/IconButton";

type Props = {
  abierto: boolean;
  onCerrar: (abierto: boolean) => void;
  titulo: string;
  children: React.ReactNode;
};

/** Modal de velo con blur (cero sombras: profundidad por capas). */
export function Modal({ abierto, onCerrar, titulo, children }: Props) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onCerrar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-isla border border-hairline bg-velo p-6 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title className="text-base font-medium text-tinta">{titulo}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton etiqueta="Cerrar">
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
