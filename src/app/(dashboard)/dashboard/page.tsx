import Link from 'next/link'
import { LayoutGrid, Plus, Users } from 'lucide-react'

import { requireProfile } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { Card, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

export default async function DashboardPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  // RLS filtre déjà sur l'admin courant : pas de .eq('admin_id') nécessaire.
  const { data: groups } = await supabase
    .from('tontine_groups')
    .select('id, name, contribution_amount, currency, members(count)')
    .order('created_at', { ascending: false })

  const groupCount = groups?.length ?? 0
  const memberCount =
    groups?.reduce(
      (acc, g) => acc + ((g.members as unknown as { count: number }[])[0]?.count ?? 0),
      0,
    ) ?? 0
  const engagedPerRound =
    groups?.reduce((acc, g) => {
      const n = (g.members as unknown as { count: number }[])[0]?.count ?? 0
      return acc + n * Number(g.contribution_amount)
    }, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bonjour {profile.first_name ?? ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue d’ensemble de vos groupes de cotisation.
          </p>
        </div>
        <Link
          href="/groups/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          <Plus className="size-4" /> Créer un groupe
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="size-4" /> Groupes
          </div>
          <p className="mt-2 text-3xl font-semibold">{groupCount}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> Membres
          </div>
          <p className="mt-2 text-3xl font-semibold">{memberCount}</p>
        </Card>
        <Card>
          <div className="text-sm text-muted-foreground">Collecte par tour</div>
          <p className="mt-2 text-3xl font-semibold">
            {formatMoney(engagedPerRound, groups?.[0]?.currency ?? 'XAF')}
          </p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Vos groupes</h2>
        {groupCount === 0 ? (
          <EmptyState
            title="Aucun groupe pour l’instant"
            description="Créez votre premier groupe de cotisation pour commencer."
            action={
              <Link
                href="/groups/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
              >
                <Plus className="size-4" /> Créer un groupe
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups!.map((g) => (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`}>
                  <Card className="transition-colors hover:border-primary-400">
                    <p className="font-medium">{g.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {(g.members as unknown as { count: number }[])[0]?.count ?? 0}{' '}
                      membre(s) ·{' '}
                      {formatMoney(Number(g.contribution_amount), g.currency)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
