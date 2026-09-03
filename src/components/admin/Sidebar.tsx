"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AudioLines,
  Bot,
  Boxes,
  CalendarDays,
  Inbox,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/lib/admin/actions";
import type { StatusGlobal } from "@/lib/bots/tipos";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/admin/ui/IconButton";
import { LogoZakumi } from "@/components/brand/LogoZakumi";
import { alternarSidebar, useSidebarColapsado } from "@/components/admin/ui/sidebar-store";

const SECCIONES = [
  // Una sola puerta: dos puertas a lo mismo se desincronizan.
  { href: "/admin/prospeccion", label: "Encontrar clientes", Icono: Target },
  { href: "/admin/zak", label: "Zak", Icono: Bot },
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

/** Contenido del sidebar: islas apiladas (marca / navegación / usuario). */
function ContenidoSidebar({
  colapsado,
  onNavegar,
}: {
  colapsado: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const salud = useSaludBots();
  const citasHoy = useCitasHoy();

  return (
    <div className="flex h-full flex-col gap-aire">
      {/* Marca: solo el logotipo, centrado. Al colapsar, la palabra se pliega
          hasta dejar la Z (animación en admin-theme.css, .adm-logo). */}
      <div className="flex items-center justify-center overflow-hidden rounded-isla bg-isla px-3 py-3.5">
        <Link
          href="/admin/prospeccion"
          aria-label="Zakumi — inicio del panel"
          className="adm-logo text-tinta"
          data-colapsado={colapsado || undefined}
        >
          <LogoZakumi decorativo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 rounded-isla bg-isla p-2">
        {SECCIONES.map(({ href, label, Icono }) => {
          const activa = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavegar}
              title={label}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-full px-3 text-sm transition-colors",
                colapsado && "justify-center px-0",
                activa
                  ? "bg-acento-10 font-medium text-acento"
                  : "text-tinta-60 hover:bg-isla-alta hover:text-tinta",
              )}
            >
              <Icono className="h-4 w-4 shrink-0" />
              {!colapsado && <span className="truncate">{label}</span>}
              {href === "/admin/bots" && salud && (
                <span
                  title={TITULO_SALUD[salud]}
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    COLOR_SALUD[salud],
                    !colapsado && "ml-auto",
                  )}
                />
              )}
              {href === "/admin/agenda" && citasHoy > 0 && (
                <span
                  title={`${citasHoy} cita(s) hoy`}
                  className={cn(
                    "rounded-full bg-acento-10 px-1.5 text-[10px] font-semibold text-acento",
                    !colapsado && "ml-auto",
                  )}
                >
                  {citasHoy}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("flex items-center gap-1 rounded-isla bg-isla p-2", colapsado && "flex-col")}>
        <form action={logout} className={cn("min-w-0", colapsado ? "w-full" : "flex-1")}>
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
        <IconButton
          etiqueta={colapsado ? "Expandir menú" : "Colapsar menú"}
          onClick={alternarSidebar}
          className="max-[899px]:hidden"
        >
          {colapsado ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </IconButton>
      </div>
    </div>
  );
}

export function Sidebar() {
  const colapsado = useSidebarColapsado();
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
        <ContenidoSidebar colapsado={colapsado} />
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
