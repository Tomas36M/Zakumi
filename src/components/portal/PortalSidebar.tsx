"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { logoutPortal } from "@/lib/portal/auth-actions";
import { AjustesModal } from "./AjustesModal";
import {
  IconoAjustes,
  IconoBot,
  IconoChevron,
  IconoInicio,
  IconoMenu,
  IconoPagos,
  IconoSalir,
  IconoSolicitudes,
  IconoTienda,
  IconoVentas,
} from "./Iconos";

const NAV = [
  { href: "/app", label: "Inicio", Icono: IconoInicio },
  { href: "/app/tienda", label: "Tienda", Icono: IconoTienda },
  { href: "/app/solicitudes", label: "Solicitudes", Icono: IconoSolicitudes },
  { href: "/app/mi-bot", label: "Mi agente", Icono: IconoBot },
  { href: "/app/mis-ventas", label: "Mis ventas", Icono: IconoVentas },
  { href: "/app/pagos", label: "Pagos", Icono: IconoPagos },
] as const;

const CLAVE_COLAPSO = "zk-portal-sidebar";
const DURACION_COLAPSO = 400; // ms — igual que la transición CSS

/* Store externo del colapso (patrón Scribe): useSyncExternalStore evita el
   setState-en-effect y el server siempre pinta expandido sin romper la
   hidratación — React re-lee el snapshot del cliente al montar. */
let colapsoValor = false;
let colapsoLeido = false;
const colapsoOyentes = new Set<() => void>();

function leerColapso(): boolean {
  if (!colapsoLeido) {
    try {
      colapsoValor = window.localStorage.getItem(CLAVE_COLAPSO) === "1";
    } catch {
      // sin localStorage (modo privado estricto): arranca expandido
    }
    colapsoLeido = true;
  }
  return colapsoValor;
}

function alternarColapso() {
  colapsoValor = !leerColapso();
  try {
    window.localStorage.setItem(CLAVE_COLAPSO, colapsoValor ? "1" : "0");
  } catch {
    // best-effort
  }
  colapsoOyentes.forEach((f) => f());
}

function suscribirColapso(f: () => void) {
  colapsoOyentes.add(f);
  return () => {
    colapsoOyentes.delete(f);
  };
}

type Props = {
  nombre: string | null;
  email: string | null;
};

/**
 * Sidebar de islas flotantes (patrón Scribe): logo, navegación y usuario son
 * tarjetas independientes; el bloque del logo Y el espacio muerto colapsan;
 * los iconos quedan anclados y solo los labels hacen fade. En móvil pasa a
 * overlay lateral con backdrop.
 */
export function PortalSidebar({ nombre, email }: Props) {
  const pathname = usePathname();
  const cerrada = useSyncExternalStore(suscribirColapso, leerColapso, () => false);
  const [abiertaMovil, setAbiertaMovil] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ajustesAbierto, setAjustesAbierto] = useState(false);

  function alternar() {
    alternarColapso();
    setMenuAbierto(false);
  }

  // Micro-detalle Scribe: abrir el menú desde el estado colapsado primero
  // expande y espera a que termine la animación — el menú no nace apretado.
  function abrirMenuUsuario() {
    if (menuAbierto) {
      setMenuAbierto(false);
      return;
    }
    if (cerrada) {
      alternar();
      window.setTimeout(() => setMenuAbierto(true), DURACION_COLAPSO);
      return;
    }
    setMenuAbierto(true);
  }

  const inicial = (nombre ?? email ?? "Z").trim().charAt(0) || "Z";
  const clasesSidebar = [
    "app-sidebar",
    cerrada ? "app-sidebar--cerrada" : "",
    abiertaMovil ? "app-sidebar--abierta-movil" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Topbar solo móvil: marca + botón de menú */}
      <div className="app-movil-topbar app-isla">
        <span className="app-side-marca">
          ZAKUMI<span className="app-side-marca-mi">Mi estudio</span>
        </span>
        <button
          type="button"
          className="app-movil-boton"
          aria-label="Abrir menú"
          onClick={() => setAbiertaMovil(true)}
        >
          <IconoMenu />
        </button>
      </div>

      {abiertaMovil && (
        <button
          type="button"
          className="app-sidebar-fondo"
          aria-label="Cerrar menú"
          onClick={() => setAbiertaMovil(false)}
        />
      )}

      <aside className={clasesSidebar}>
        <button
          type="button"
          className="app-side-logo app-isla"
          onClick={alternar}
          aria-label={cerrada ? "Expandir menú" : "Contraer menú"}
          title={cerrada ? "Expandir" : "Contraer"}
        >
          <span className="app-side-marca">
            Z{!cerrada && "AKUMI"}
            {!cerrada && <span className="app-side-marca-mi">Mi estudio</span>}
          </span>
          <span className="app-side-chevron">
            <IconoChevron />
          </span>
        </button>

        <nav aria-label="Portal" className="app-side-nav app-isla">
          {NAV.map(({ href, label, Icono }) => {
            const activo =
              href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  activo ? "app-nav-item app-nav-item--activo" : "app-nav-item"
                }
                onClick={() => setAbiertaMovil(false)}
              >
                <span className="app-nav-icono">
                  <Icono />
                </span>
                <span className="app-nav-label">{label}</span>
              </Link>
            );
          })}
          {/* El espacio muerto también colapsa (decorativo: el botón del
              logo cubre el mismo gesto para teclado). */}
          <div className="app-side-muerto" aria-hidden onClick={alternar} />
        </nav>

        <div className="app-side-user app-isla">
          {menuAbierto && (
            <>
              <button
                type="button"
                className="app-menu-fondo"
                aria-label="Cerrar menú de cuenta"
                onClick={() => setMenuAbierto(false)}
              />
              <div className="app-menu" role="menu">
                <button
                  type="button"
                  className="app-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuAbierto(false);
                    setAjustesAbierto(true);
                  }}
                >
                  <IconoAjustes />
                  Ajustes
                </button>
                <form action={logoutPortal}>
                  <button
                    type="submit"
                    className="app-menu-item app-menu-item--peligro"
                    role="menuitem"
                  >
                    <IconoSalir />
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </>
          )}
          <button
            type="button"
            className="app-user-pildora"
            onClick={abrirMenuUsuario}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
          >
            <span className="app-user-avatar">{inicial}</span>
            <span className="app-user-datos">
              <span className="app-user-nombre">{nombre ?? "Tu cuenta"}</span>
              <span className="app-user-correo">{email ?? ""}</span>
            </span>
          </button>
        </div>
      </aside>

      {ajustesAbierto && (
        <AjustesModal
          nombre={nombre}
          email={email}
          onCerrar={() => setAjustesAbierto(false)}
        />
      )}
    </>
  );
}
