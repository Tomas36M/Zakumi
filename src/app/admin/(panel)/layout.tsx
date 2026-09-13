import { cookies } from "next/headers";
import { Sidebar } from "@/components/admin/Sidebar";
import { COOKIE_SIDEBAR, colapsadoDeCookie } from "@/lib/admin/sidebar-cookie";

// Chrome del panel. SIN check de sesión a propósito: en Next 16 los layouts
// no se re-renderizan al navegar, así que la auth vive en el proxy y en
// verifySession() dentro de cada page/action/handler.
export default async function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La preferencia del sidebar viaja en cookie para pintar el estado real
  // desde el servidor: con localStorage arrancaba expandido y saltaba al
  // hidratar. Los layouts no se re-renderizan al navegar, pero el store del
  // cliente toma el relevo a partir del primer clic.
  const colapsado = colapsadoDeCookie((await cookies()).get(COOKIE_SIDEBAR)?.value);

  return (
    <div className="flex min-h-dvh gap-aire p-aire">
      <Sidebar colapsadoInicial={colapsado} />
      <main className="barra-fina min-w-0 flex-1 overflow-y-auto rounded-isla bg-isla">
        {children}
      </main>
    </div>
  );
}
