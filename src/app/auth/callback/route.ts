import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Échange le code reçu par email (confirmation de compte, réinitialisation de
 * mot de passe) contre une session. Cette route est exclue du matcher du proxy :
 * elle doit pouvoir poser ses cookies sans être redirigée vers /login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=lien_invalide`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=lien_expire`)
  }

  return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/dashboard'}`)
}
