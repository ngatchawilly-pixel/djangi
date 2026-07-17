import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Next.js 16 : ce fichier s'appelait `middleware.ts` jusqu'en v15. La fonction
 * doit s'exporter sous le nom `proxy`, et le runtime est Node.js (l'edge n'est
 * pas supporté ici et n'est pas configurable).
 *
 * Rôle volontairement limité à deux choses :
 *   1. rafraîchir la session Supabase et réécrire les cookies ;
 *   2. une redirection optimiste pour éviter d'afficher une page vide.
 *
 * La doc Next est explicite : le proxy n'est PAS une solution d'autorisation.
 * Le contrôle d'accès réel vit dans `@/lib/auth/dal` (côté serveur) et surtout
 * dans les policies RLS, qui restent la seule barrière qui compte.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() (et non getSession()) : revalide le jeton auprès de Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Tout sauf : fichiers statiques, images, favicon, et la route de callback
     * d'authentification (qui doit poser ses cookies sans redirection).
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
