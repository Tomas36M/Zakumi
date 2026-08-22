import { getSesion } from "@/lib/auth/sesion";
import { PortalSidebar } from "@/components/portal/PortalSidebar";

// Chrome del portal. SIN check de sesión a propósito: en Next 16 los layouts
// no se re-renderizan al navegar, así que la auth vive en el proxy y en
// verifySesionPortal() dentro de cada page/action/handler. La sesión aquí es
// solo DATO para pintar el chrome (nombre en la píldora del usuario).
export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sesion = await getSesion();
  return (
    <div className="app-marco">
      <PortalSidebar
        nombre={sesion?.nombre ?? null}
        email={sesion?.email ?? null}
      />
      <main className="app-main app-isla">{children}</main>
    </div>
  );
}
