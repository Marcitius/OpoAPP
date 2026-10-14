import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let instance: SupabaseClient | undefined;
export function configurationError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    !url ||
    !key ||
    url.includes("YOUR_PROJECT") ||
    key.includes("REPLACE_ME")
  )
    return "Configura la URL y la clave pública de Supabase en .env.local y vuelve a compilar.";
  if (key.startsWith("sb_secret_"))
    return "La clave debe ser pública (publishable o anon). No utilices una clave secreta.";
  try {
    if (
      key.split(".").length === 3 &&
      JSON.parse(atob(key.split(".")[1])).role === "service_role"
    )
      return "No se permite una clave service_role en el navegador.";
  } catch {}
  try {
    new URL(url);
  } catch {
    return "La URL de Supabase no es válida.";
  }
  return null;
}
export function supabase() {
  if (configurationError()) throw new Error(configurationError()!);
  return (instance ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "opogc-auth-v10",
      },
    },
  ));
}
