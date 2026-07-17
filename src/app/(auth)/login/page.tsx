import Link from 'next/link'

import { LoginForm } from './login-form'

// Next.js 16 : searchParams est une Promise (l'accès synchrone est supprimé).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  const { redirectTo } = await searchParams

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Accédez à vos groupes de cotisation.
      </p>

      <LoginForm redirectTo={redirectTo ?? '/dashboard'} />

      <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-primary-600 hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
