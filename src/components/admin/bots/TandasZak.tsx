"use client";

import { fechaCorta } from "@/lib/admin/formato";
import type { Tanda } from "@/lib/bots/tipos";
import { Banner } from "@/components/admin/ui/Banner";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Island } from "@/components/admin/ui/Island";

const ETAPAS = [
  ["pendiente", "En cola"],
  ["enviado", "Enviado"],
  ["entregado", "Entregado"],
  ["leido", "Leído"],
  ["respondido", "Respondió"],
] as const;

/** El funnel de cada tanda de prospección que salió por WhatsApp. */
export function TandasZak({ tandas }: { tandas: Tanda[] }) {
  return (
    <div className="flex flex-col gap-4">
      {tandas.length === 0 && (
        <EmptyState
          titulo="Sin tandas todavía."
          detalle="En Negocios: selecciona prospectos y dale a «Que Zak los contacte»."
        />
      )}
      {tandas.map((t) => {
        const total =
          t.funnel.pendiente +
          t.funnel.enviado +
          t.funnel.entregado +
          t.funnel.leido +
          t.funnel.respondido +
          t.funnel.fallido;
        return (
          <Island
            key={t.id}
            className="bg-isla-alta"
            titulo={
              <>
                Tanda #{t.id} · {fechaCorta(t.creado_en)}
              </>
            }
            acciones={
              <span className="text-xs text-tinta-40">
                {t.plantilla} · {total} prospectos
              </span>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-aire">
                {ETAPAS.map(([clave, label]) => (
                  <div key={clave} className="flex flex-col gap-0.5 rounded-fila bg-isla p-3">
                    <span className="text-2xl font-semibold text-tinta">{t.funnel[clave]}</span>
                    <span className="text-xs text-tinta-60">{label}</span>
                  </div>
                ))}
                <div className="flex flex-col gap-0.5 rounded-fila bg-acento-10 p-3">
                  <span className="text-2xl font-semibold text-acento">{t.interesados}</span>
                  <span className="text-xs text-tinta-60">Interesados 🧡</span>
                </div>
              </div>
              {t.funnel.fallido > 0 && (
                <Banner variante="error">
                  {t.funnel.fallido} envío(s) fallidos — si el error menciona la plantilla,
                  revisa que «{t.plantilla}» esté aprobada en Meta.
                </Banner>
              )}
              {t.notas && <p className="text-xs text-tinta-60">{t.notas}</p>}
            </div>
          </Island>
        );
      })}
    </div>
  );
}
