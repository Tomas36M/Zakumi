"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { LogoZakumi } from "@/components/brand/LogoZakumi";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/components/zakumi/contact";
import { SERVICIOS, SERVICE_SLUGS } from "@/components/zakumi/services";

// Las animaciones (GSAP, ~44KB gzip) viven en SiteMotion y se cargan aparte,
// sin SSR: el markup de abajo es idéntico con o sin ellas. En las páginas
// legales no se montan — son texto plano y su propio comentario lo dice.
const SiteMotion = dynamic(() => import("./SiteMotion").then((m) => m.SiteMotion), {
  ssr: false,
});

const RUTAS_SIN_ANIMACION = new Set(["/privacidad", "/terminos"]);

const TWEAK_DEFAULTS = { bgMode: "full" as const, accent: "#DB5227" };

const NAV_ITEMS = [
  ...SERVICE_SLUGS.map((s) => ({ href: `/${s}`, label: SERVICIOS[s].nav })),
  { href: "/academia", label: "Academia" },
  { href: "/precios", label: "Precios" },
  { href: "/contacto", label: "Contacto" },
  // «Mi Zakumi» (portal /app) fuera del nav mientras el portal esté apagado
  // (flag PORTAL_ABIERTO en proxy.ts): aún no es presentable.
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const conMovimiento = !RUTAS_SIN_ANIMACION.has(pathname);
  // La cortina es un gesto de carga INICIAL: solo si el documento arrancó en
  // home. El valor se congela en el primer render (el layout persiste entre
  // navegaciones) y es el mismo en el servidor y al hidratar. Sin esto, una
  // visita que empieza en /privacidad —donde SiteMotion no se monta— y pasa
  // a home pintaría la cortina negra hasta que llegue el chunk de GSAP, y
  // después la reproduciría entera.
  const [arrancoEnHome] = React.useState(isHome);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // ——— CSS vars: --orange / bg-* ———
  // (Antes esto también seteaba --hero-size, pero ninguna regla del CSS lo
  // consumía: el tamaño del h1 lo manda el clamp de .hero h1.)
  useEffect(() => {
    document.documentElement.style.setProperty("--orange", TWEAK_DEFAULTS.accent);
    const bg = document.getElementById("bg");
    if (bg) {
      const mode = TWEAK_DEFAULTS.bgMode as string;
      bg.classList.toggle("bg-full", mode === "full");
      bg.classList.toggle("bg-mix", mode === "mix");
    }
  }, []);

  // ——— nav.scrolled — vanilla, sin GSAP: también en las páginas legales ———
  // Equivale al ScrollTrigger de antes (start: "top -50" → scrollY > 50).
  useEffect(() => {
    const nav = document.querySelector("nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ——— Menú móvil ———
  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.matchMedia("(min-width: 721px)").matches) setMenuOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="bg-base bg-full" id="bg" />
      <div className="grain" />

      {conMovimiento && <SiteMotion isHome={isHome} />}

      {isHome && arrancoEnHome && (
        <div className="curtain" id="curtain">
          <div className="curtain-panel" id="curtain-panel" />
          <div className="curtain-inner"><span>ZAKUMI</span><span className="dot" /><span>ESTUDIO</span></div>
          <div className="curtain-label">CARGANDO · MMXXVI</div>
          <div className="curtain-counter" id="curtain-counter">00</div>
        </div>
      )}

      {/* Sin GSAP el anillo/punto del cursor y la barra quedarían clavados en
          su posición CSS inicial: en las páginas legales no se pintan. */}
      {conMovimiento && (
        <div className="scroll-progress"><div className="fill" id="scroll-fill" /></div>
      )}

      <div id="app">
        {conMovimiento && (
          <>
            <div className="cursor-ring" />
            <div className="cursor-dot" />
          </>
        )}

        <nav className={menuOpen ? "nav-menu-open" : undefined}>
          <div className="nav-logo">
            <Link href="/" aria-label="Zakumi — inicio"><LogoZakumi decorativo /></Link>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </div>
          <button type="button" className={`nav-toggle${menuOpen ? " is-open" : ""}`}
            aria-expanded={menuOpen} aria-controls="zakumi-mobile-nav" onClick={() => setMenuOpen((o) => !o)}>
            <span className="sr-only">{menuOpen ? "Cerrar menú" : "Abrir menú"}</span>
            <span className="nav-toggle-bars" aria-hidden><span /><span /><span /></span>
          </button>
        </nav>

        <div id="zakumi-mobile-nav" className={`nav-overlay${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen}>
          <div className="nav-overlay-backdrop" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="nav-overlay-panel">
            <div className="nav-overlay-heading">Navegación</div>
            {NAV_ITEMS.map(({ href, label }) => (
              <Link key={`m-${href}`} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>
            ))}
          </div>
        </div>

        {children}

        <footer>
          <div>© 2026 ZAKUMI Studio · Colombia</div>
          <a className="footer-social" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
            aria-label={`Síguenos en Instagram — @${INSTAGRAM_HANDLE}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            <span className="footer-handle">@{INSTAGRAM_HANDLE}</span>
          </a>
          <div>IA · Software · Marca</div>
        </footer>
      </div>
    </>
  );
}
