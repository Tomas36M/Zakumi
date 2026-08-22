import { Sidebar } from "@/components/admin/Sidebar";

// Chrome del panel. SIN check de sesión a propósito: en Next 16 los layouts
// no se re-renderizan al navegar, así que la auth vive en el proxy y en
// verifySession() dentro de cada page/action/handler.
export default function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh gap-aire p-aire">
      <Sidebar />
      <main className="barra-fina min-w-0 flex-1 overflow-y-auto rounded-isla bg-isla">
        {children}
      </main>
    </div>
  );
}
