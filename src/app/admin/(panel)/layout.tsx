import { AdminNav } from "@/components/admin/AdminNav";

// Chrome del panel. SIN check de sesión a propósito: en Next 16 los layouts
// no se re-renderizan al navegar, así que la auth vive en el proxy y en
// verifySession() dentro de cada page/action/handler.
export default function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AdminNav />
      <main className="adm-main">{children}</main>
    </>
  );
}
