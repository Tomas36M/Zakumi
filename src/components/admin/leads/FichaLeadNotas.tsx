"use client";

import { useEffect, useState, useTransition } from "react";
import { agregarNota } from "@/lib/admin/actions";
import type { Nota } from "@/lib/admin/negocios";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

async function fetchNotas(negocioId: string): Promise<Nota[]> {
  const supabase = createSupabaseBrowser();
  const { data } = await supabase
    .from("notas")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false });
  return (data as Nota[]) ?? [];
}

type Props = {
  negocioId: string;
  /** `updated_at` del negocio: cambia con cada guardado y el trigger de la
   * base deja nota automática al cambiar de estado — se vuelven a leer. */
  version: string;
};

/** Las notas del lead: las que se escriben aquí y las automáticas. */
export function FichaLeadNotas({ negocioId, version }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [notaNueva, setNotaNueva] = useState("");

  useEffect(() => {
    let activo = true;
    fetchNotas(negocioId).then((ns) => {
      if (activo) setNotas(ns);
    });
    return () => {
      activo = false;
    };
  }, [negocioId, version]);

  return (
    <Island className="bg-isla-alta/50" titulo="Notas" aria-label="Notas del negocio">
      <form
        className="mb-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const texto = notaNueva.trim();
          if (!texto) return;
          setError(null);
          startGuardar(async () => {
            const res = await agregarNota(negocioId, texto);
            if (res.error) {
              setError(res.error);
              return;
            }
            setNotaNueva("");
            setNotas(await fetchNotas(negocioId));
          });
        }}
      >
        <TextArea
          value={notaNueva}
          onChange={(e) => setNotaNueva(e.target.value)}
          placeholder="Qué pasó con este negocio…"
          rows={2}
          maxLength={4000}
        />
        <Button type="submit" className="self-start" disabled={guardando || !notaNueva.trim()}>
          Anotar
        </Button>
      </form>

      {error && <Banner variante="error">{error}</Banner>}

      {notas === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : notas.length === 0 ? (
        <p className="text-sm text-tinta-40">
          Todavía no hay notas. La primera se escribe sola al cambiar el estado.
        </p>
      ) : (
        <ul className="barra-fina flex max-h-64 flex-col gap-1 overflow-y-auto">
          {notas.map((n) => (
            <li key={n.id}>
              <ListRow interactiva={false} className="flex flex-col gap-0.5">
                <span className="text-xs text-tinta-40">
                  {new Date(n.created_at).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className={n.automatica ? "text-sm text-tinta-60 italic" : "text-sm text-tinta"}>
                  {n.texto}
                </span>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </Island>
  );
}
