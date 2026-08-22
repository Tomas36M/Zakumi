import { cn } from "@/lib/cn";

type Props = {
  /** cliente = con fondo, ancho acotado; agente = ancho completo, autor en color. */
  lado: "cliente" | "agente";
  autor: string;
  hora?: string;
  /** Color de la etiqueta de autor del agente (acento = Zak/Tú; neutro = sistema). */
  tonoAutor?: "acento" | "neutro";
  children: React.ReactNode;
};

export function ChatBubble({ lado, autor, hora, tonoAutor = "acento", children }: Props) {
  if (lado === "cliente") {
    return (
      <div className="flex justify-start">
        <div className="w-fit max-w-[85%] rounded-fila bg-isla-alta px-4 py-2.5">
          <p className="mb-1 text-xs text-tinta-40">
            {autor}
            {hora ? ` · ${hora}` : ""}
          </p>
          <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-tinta">
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full">
      <p
        className={cn(
          "mb-1 text-xs font-medium tracking-wide",
          tonoAutor === "acento" ? "text-acento" : "text-tinta-60",
        )}
      >
        {autor}
        {hora ? <span className="font-normal text-tinta-40"> · {hora}</span> : null}
      </p>
      <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-tinta-85">
        {children}
      </div>
    </div>
  );
}
