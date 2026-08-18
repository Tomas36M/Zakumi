"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/admin/actions";
import type { StatusGlobal } from "@/lib/bots/tipos";

const SECCIONES = [
  { href: "/admin/mapa", label: "Mapa" },
  { href: "/admin/negocios", label: "Negocios" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/bots", label: "Bots" },
] as const;

type Salud = "ok" | "atencion" | "problema";

function saludDe(status: StatusGlobal): Salud {
  if (status.cola.jobs_fallidos > 0) return "problema";
  if (status.cola.jobs_pendientes > 5 || status.cola.edad_del_job_mas_viejo_s > 120) {
    return "atencion";
  }
  return "ok";
}

/** Punto de salud junto a "Bots": enterarse de una caída sin entrar a la página. */
function useSaludBots(): Salud | null {
  const [salud, setSalud] = useState<Salud | null>(null);

  useEffect(() => {
    let activo = true;
    async function poll() {
      try {
        const res = await fetch("/admin/api/bots/status");
        if (!activo) return;
        if (!res.ok) throw new Error(String(res.status));
        setSalud(saludDe((await res.json()) as StatusGlobal));
      } catch {
        if (activo) setSalud("problema");
      }
    }
    void poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, []);

  return salud;
}

// OJO: nada de <nav>/<footer> desnudos en el panel — zakumi-design.css los
// estila (nav fijo de la landing) y llega hasta aquí vía globals.css.
export function AdminNav() {
  const pathname = usePathname();
  const salud = useSaludBots();

  return (
    <header className="adm-topbar">
      <Link href="/admin/mapa" className="adm-topbar-marca">
        ZAKUMI<span className="adm-topbar-panel">Panel</span>
      </Link>
      <div className="adm-topbar-secciones">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={
              pathname.startsWith(s.href)
                ? "adm-topbar-link adm-topbar-link--activo"
                : "adm-topbar-link"
            }
          >
            {s.label}
            {s.href === "/admin/bots" && salud && (
              <span
                className={`adm-salud adm-salud--${salud}`}
                title={
                  salud === "ok"
                    ? "Bots al día"
                    : salud === "atencion"
                      ? "Cola de mensajes acumulada"
                      : "Jobs fallidos o sin conexión"
                }
              />
            )}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button className="adm-cta-ghost" type="submit">
          Salir
        </button>
      </form>
    </header>
  );
}
