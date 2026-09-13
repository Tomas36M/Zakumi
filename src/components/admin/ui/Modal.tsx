"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/admin/ui/IconButton";
import { cn } from "@/lib/cn";

type Tamano = "normal" | "ancho";

const ANCHO: Record<Tamano, string> = {
  normal: "w-[min(480px,calc(100vw-2rem))]",
  // Las fichas (lead, cliente, solicitud) van a dos columnas.
  ancho: "w-[min(840px,calc(100vw-2rem))]",
};

type Props = {
  abierto: boolean;
  onCerrar: (abierto: boolean) => void;
  titulo: string;
  /** Una línea bajo el título; también es lo que Radix anuncia como descripción. */
  descripcion?: string;
  tamano?: Tamano;
  children: React.ReactNode;
};

/** Modal de velo con blur (cero sombras: profundidad por capas). */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  tamano = "normal",
  children,
}: Props) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onCerrar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        {/* max-h + overflow: el diálogo está centrado y fijo, así que un
            cuerpo más alto que la ventana se desbordaba por ARRIBA y por
            ABAJO sin barra de scroll — y el botón de confirmar quedaba
            inalcanzable. Le pasaba justo al más caro de todos (el de barrer,
            que es el más alto del panel) en una ventana baja. */}
        <Dialog.Content
          // Sin descripción, Radix avisa por consola en cada apertura; con
          // `undefined` explícito se le dice que no hay y calla.
          {...(descripcion ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-isla border border-hairline bg-velo p-6 backdrop-blur-xl",
            ANCHO[tamano],
          )}
        >
          <div className={cn("flex items-center justify-between gap-2", descripcion ? "mb-1" : "mb-3")}>
            <Dialog.Title className="text-base font-medium text-tinta">{titulo}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton etiqueta="Cerrar">
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          {descripcion && (
            <Dialog.Description className="mb-3 text-xs text-tinta-60">
              {descripcion}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
