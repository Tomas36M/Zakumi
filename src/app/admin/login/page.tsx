import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="adm-login">
      <div className="adm-login-card">
        <p className="adm-login-marca">ZAKUMI</p>
        <h1 className="adm-login-titulo">Centro de control</h1>
        <p className="adm-login-lead">
          Acceso interno. Las cuentas se crean desde Supabase.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
