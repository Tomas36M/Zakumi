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
      <div className="flex items-center justify-between rounded-isla bg-isla px-3 py-3">
        {!colapsado && (
          <Link href="/admin/prospeccion" className="pl-1 text-sm font-bold tracking-wide text-tinta">
            ZAKUMI <span className="font-editorial text-acento italic">Panel</span>
          </Link>
        )}
        <IconButton
          etiqueta={colapsado ? "Expandir menú" : "Colapsar menú"}
          onClick={alternarSidebar}
          className="max-[899px]:hidden"
        >
          {colapsado ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </IconButton>
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

export function Sidebar() {
  const colapsado = useSidebarColapsado();
  const [movilAbierto, setMovilAbierto] = useState(false);
  const pathname = usePathname();

  // Cerrar el overlay móvil al navegar.
  useEffect(() => {
    setMovilAbierto(false);
  }, [pathname]);

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
        onClick={() => setMovilAbierto(true)}
        className="fixed bottom-4 left-4 z-40 bg-isla-alta backdrop-blur min-[900px]:hidden"
      >
        <Menu className="h-4 w-4" />
      </IconButton>
      {movilAbierto && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMovilAbierto(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col p-aire">
            <div className="mb-aire self-end">
              <IconButton etiqueta="Cerrar menú" onClick={() => setMovilAbierto(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">
              <ContenidoSidebar colapsado={false} onNavegar={() => setMovilAbierto(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
