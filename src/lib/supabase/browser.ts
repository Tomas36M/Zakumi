"use client";

import { createBrowserClient } from "@supabase/ssr";

type SupabaseBrowser = ReturnType<typeof createBrowserClient>;

let cliente: SupabaseBrowser | undefined;

/** Cliente de Supabase del browser (singleton por pestaña). */
export function createSupabaseBrowser(): SupabaseBrowser {
  cliente ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cliente;
}
