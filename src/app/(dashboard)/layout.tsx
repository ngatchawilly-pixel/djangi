import Link from 'next/link'
import { Home, LayoutGrid, LogOut, Settings, Users } from 'lucide-react'

import { logout } from '@/actions/auth.actions'
import { requireProfile } from '@/lib/auth/dal'
import { Button } from '@/components/ui'

const NAV = [
  { href: '/dashboard', label: 'Tableau de bord', icon: Home },
  { href: '/groups', label: 'Groupes', icon: LayoutGrid },
  { href: '/my-groups', label: 'Mes participations', icon: Users },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireProfile()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            <span className="text-primary-500">●</span> Tontine
          </Link>

          {/* Exigence 19.4 : la nav passe en bas d'écran sur mobile. */}
          <nav className="hidden md:flex md:items-center md:gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile.first_name ?? profile.email}
            </span>
            <Link
              href="/settings"
              aria-label="Paramètres"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <Settings className="size-4" />
            </Link>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit" aria-label="Se déconnecter">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs"
          >
            <Icon className="size-5" />
            {label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  )
}
