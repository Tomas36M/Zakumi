"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/admin/actions";

const SECCIONES = [
  { href: "/admin/mapa", label: "Mapa" },
  { href: "/admin/negocios", label: "Negocios" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/bots", label: "Bots" },
] as const;

// OJO: nada de <nav>/<footer> desnudos en el panel — zakumi-design.css los
// estila (nav fijo de la landing) y llega hasta aquí vía globals.css.
export function AdminNav() {
  const pathname = usePathname();

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
