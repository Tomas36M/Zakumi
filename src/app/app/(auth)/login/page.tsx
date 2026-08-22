import type { Metadata } from "next";
import Link from "next/link";
import { LoginPortalForm } from "@/components/portal/auth/LoginPortalForm";
import { BotonGoogle } from "@/components/portal/auth/BotonGoogle";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="app-auth">
      <Link href="/" className="app-auth-volver">
        ← Volver al sitio
      </Link>
      <div className="app-auth-card">
        <Link href="/" className="app-auth-marca">
          ZAKUMI<span className="app-side-marca-mi">Mi estudio</span>
        </Link>
        <h1 className="app-auth-titulo">Entra a tu estudio</h1>
        {error === "callback" && (
          <p className="app-aviso" role="alert">
            El enlace no funcionó o ya venció. Entra con tu correo o pide uno nuevo
            registrándote otra vez.
          </p>
        )}
        <LoginPortalForm />
        <div className="app-auth-divisor">o</div>
        <BotonGoogle />
        <p className="app-auth-pie">
          ¿Primera vez aquí? <Link href="/app/registro">Crea tu cuenta</Link>
        </p>
      </div>
    </div>
  );
}
