import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-aire">
      <div className="w-full max-w-sm rounded-isla bg-isla p-6">
        <p className="text-xs font-bold tracking-[0.2em] text-tinta-60">ZAKUMI</p>
        <h1 className="mt-1 text-lg font-semibold text-tinta">Centro de control</h1>
        <p className="mt-1 mb-5 text-sm text-tinta-60">
          Acceso interno. Las cuentas se crean desde Supabase.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
