/**
 * Les deux variables sont publiques par conception : la clé `anon` est destinée
 * au navigateur, c'est RLS qui protège les données. Ne jamais exposer ici la clé
 * `service_role`, qui contourne RLS.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Copiez .env.local.example vers .env.local et renseignez vos clés Supabase.`,
    )
  }
  return value
}

export const SUPABASE_URL = () =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)

export const SUPABASE_ANON_KEY = () =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
