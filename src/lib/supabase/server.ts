import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 *
 * Next.js 16 : `cookies()` est asynchrone — l'accès synchrone, encore toléré en
 * 15, a été supprimé. Cette fonction doit donc être awaited.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Écriture impossible depuis un Server Component : c'est le proxy qui
          // rafraîchit la session, donc on peut ignorer.
        }
      },
    },
  })
}
