import type { Metadata } from "next";
import Link from "next/link";
import { RegistroForm } from "@/components/portal/auth/RegistroForm";
import { BotonGoogle } from "@/components/portal/auth/BotonGoogle";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <div className="app-auth">
      <div className="app-auth-card">
        <Link href="/" className="app-auth-marca">
          ZAKUMI<span className="app-side-marca-mi">Mi estudio</span>
        </Link>
        <h1 className="app-auth-titulo">Crea tu cuenta</h1>
        <RegistroForm />
        <div className="app-auth-divisor">o</div>
        <BotonGoogle />
        <p className="app-auth-pie">
          ¿Ya tienes cuenta? <Link href="/app/login">Entra</Link>
        </p>
      </div>
    </div>
  );
}
