"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AudioLines,
  Bot,
  Boxes,
  CalendarDays,
  Contact,
  Gauge,
  Inbox,
  LandPlot,
  LogOut,
  Menu,
  Target,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/lib/admin/actions";
import { seccionActiva } from "@/lib/admin/navegacion";
import type { StatusGlobal } from "@/lib/bots/tipos";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/admin/ui/IconButton";
import { LogoZakumi } from "@/components/brand/LogoZakumi";
import { alternarSidebar, useSidebarColapsado } from "@/components/admin/ui/sidebar-store";

const SECCIONES = [
  // Una sola pantalla por cosa: «Negocios» no es otra puerta a otra pantalla,
  // es un atajo a la cara Leads de Encontrar clientes (ver navegacion.ts).
  { href: "/admin/prospeccion", label: "Encontrar clientes", Icono: Target },
  { href: "/admin/territorios", label: "Territorios", Icono: LandPlot },
  { href: "/admin/prospeccion?tab=leads", label: "Negocios", Icono: Contact },
  { href: "/admin/zak", label: "Zak", Icono: Bot },
  { href: "/admin/metricas", label: "Métricas", Icono: Gauge },
  { href: "/admin/solicitudes", label: "Solicitudes", Icono: Inbox },
  { href: "/admin/agenda", label: "Agenda", Icono: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", Icono: Users },
  { href: "/admin/bots", label: "Bots", Icono: Boxes },
  { href: "/admin/voz", label: "Voz", Icono: AudioLines },
  { href: "/admin/equipo", label: "Equipo", Icono: UserCog },
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

const COLOR_SALUD: Record<Salud, string> = {
  ok: "bg-vivo",
  atencion: "bg-estado-contactado",
  problema: "bg-peligro",
};

const TITULO_SALUD: Record<Salud, string> = {
  ok: "Bots al día",
  atencion: "Cola de mensajes acumulada",
  problema: "Jobs fallidos o sin conexión",
};

/** Píldora junto a "Agenda": cuántas citas hay hoy sin entrar a la página. */
function useCitasHoy(): number {
  const [citasHoy, setCitasHoy] = useState(0);

  useEffect(() => {
    let activo = true;
    async function poll() {
      try {
        const res = await fetch("/admin/api/agenda/hoy");
        if (!activo) return;
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hoy: number };
        setCitasHoy(data.hoy);
      } catch {
        // Sin conexión: se queda con el último número conocido — mejor eso
        // que la píldora parpadeando a 0 en cada corte de red.
      }
    }
    void poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, []);

  return citasHoy;
}

/**
 * Isla de marca. En desktop es EL botón de colapsar: toda la isla es objetivo
 * de clic. Al colapsar, la palabra se pliega hasta dejar la Z (animación en
 * admin-theme.css, .adm-logo).
 * En el overlay móvil no hay nada que colapsar: el logo vuelve a ser el
 * enlace al inicio del panel.
 */
function Marca({ colapsado, onAlternar }: { colapsado: boolean; onAlternar?: () => void }) {
  const logo = (
    <span className="adm-logo text-tinta" data-colapsado={colapsado || undefined}>
      <LogoZakumi decorativo />
    </span>
  );

  if (!onAlternar) {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-isla bg-isla px-3 py-3.5">
        <Link href="/admin/prospeccion" aria-label="Zakumi — inicio del panel">
          {logo}
        </Link>
      </div>
    );
  }

  // Sin flecha: el logo solo, como en el resto de la marca. El hover y el
  // tooltip ya dicen que se puede tocar.
  const etiqueta = colapsado ? "Expandir menú" : "Colapsar menú";
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={!colapsado}
      aria-controls="adm-nav"
      aria-label={etiqueta}
      title={etiqueta}
      className="flex items-center justify-center overflow-hidden rounded-isla bg-isla px-3 py-3.5 transition-colors hover:bg-isla-alta"
    >
      {logo}
    </button>
  );
}

type PropsNav = {
  colapsado: boolean;
  onNavegar?: () => void;
  pathname: string;
  salud: Salud | null;
  citasHoy: number;
};

/** Lee la pestaña de la URL: «Negocios» y «Encontrar clientes» comparten ruta
 * y solo `?tab=` dice cuál de las dos está abierta. */
function NavConPestana(props: PropsNav) {
  const tab = useSearchParams().get("tab");
  return <NavSecciones {...props} tab={tab} />;
}

function NavSecciones({ colapsado, onNavegar, pathname, salud, citasHoy, tab }: PropsNav & { tab: string | null }) {
  return (
    <nav id="adm-nav" className="flex flex-1 flex-col gap-1 rounded-isla bg-isla p-2">
      {SECCIONES.map(({ href, label, Icono }) => {
        const activa = seccionActiva(href, pathname, tab);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavegar}
            title={label}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-2.5 rounded-full px-3 text-sm transition-colors",
              colapsado && "justify-center px-0",
              activa
                ? "bg-acento-10 font-medium text-acento"
                : "text-tinta-60 hover:bg-isla-alta hover:text-tinta",
            )}
          >
            <Icono className="h-4 w-4 shrink-0" />
            {!colapsado && <span className="truncate">{label}</span>}
            {/* Colapsado, el hueco útil son 40px: icono + gap + píldora no
                caben en fila, así que los avisos se montan sobre la esquina
                del icono en vez de empujarlo fuera de la isla. */}
            {href === "/admin/bots" && salud && (
              <span
                title={TITULO_SALUD[salud]}
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  COLOR_SALUD[salud],
                  colapsado ? "absolute top-1.5 right-2.5" : "ml-auto",
                )}
              />
            )}
            {href === "/admin/agenda" && citasHoy > 0 && (
              <span
                title={`${citasHoy} cita(s) hoy`}
                className={cn(
                  "rounded-full bg-acento-10 font-semibold text-acento",
                  colapsado
                    ? "absolute -top-0.5 right-0.5 h-4 min-w-4 px-1 text-center text-[9px] leading-4"
                    : "ml-auto px-1.5 text-[10px]",
                )}
              >
                {citasHoy}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Contenido del sidebar: islas apiladas (marca / navegación / usuario). */
function ContenidoSidebar({
  colapsado,
  onNavegar,
  onAlternar,
}: {
  colapsado: boolean;
  onNavegar?: () => void;
  /** Sin esto (overlay móvil) la isla de marca es un enlace, no un botón. */
  onAlternar?: () => void;
}) {
  const pathname = usePathname();
  const salud = useSaludBots();
  const citasHoy = useCitasHoy();
  const nav: PropsNav = { colapsado, onNavegar, pathname, salud, citasHoy };

  return (
    <div className="flex h-full flex-col gap-aire">
      <Marca colapsado={colapsado} onAlternar={onAlternar} />

      {/* useSearchParams pide un límite de Suspense (Next 16). Mientras se
          resuelve, el menú se pinta igual, solo que sin leer la pestaña. */}
      <Suspense fallback={<NavSecciones {...nav} tab={null} />}>
        <NavConPestana {...nav} />
      </Suspense>

      <div className="rounded-isla bg-isla p-2">
        <form action={logout}>
          <button
            type="submit"
            title="Salir"
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-sm text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta",
              colapsado && "justify-center px-0",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!colapsado && <span>Salir</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar({ colapsadoInicial }: { colapsadoInicial: boolean }) {
  const colapsado = useSidebarColapsado(colapsadoInicial);
  const pathname = usePathname();
  // El overlay móvil recuerda en qué ruta se abrió: al navegar (también con
  // atrás/adelante) deja de coincidir y se cierra solo, sin setState en un efecto.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const movilAbierto = abiertoEn === pathname;
  const abrirMovil = () => setAbiertoEn(pathname);
  const cerrarMovil = () => setAbiertoEn(null);

  return (
    <>
      {/* Desktop: columna estática colapsable */}
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 min-[900px]:block",
          colapsado ? "w-14" : "w-60",
        )}
      >
        <ContenidoSidebar colapsado={colapsado} onAlternar={alternarSidebar} />
      </aside>

      {/* Móvil: botón flotante + overlay con velo */}
      <IconButton
        etiqueta="Abrir menú"
        onClick={abrirMovil}
        className="fixed bottom-4 left-4 z-40 bg-isla-alta backdrop-blur min-[900px]:hidden"
      >
        <Menu className="h-4 w-4" />
      </IconButton>
      {movilAbierto && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={cerrarMovil}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col p-aire">
            <div className="mb-aire self-end">
              <IconButton etiqueta="Cerrar menú" onClick={cerrarMovil}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">
              <ContenidoSidebar colapsado={false} onNavegar={cerrarMovil} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
