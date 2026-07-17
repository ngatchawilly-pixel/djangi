import Link from 'next/link'
import { Plus } from 'lucide-react'

import { requireAdmin } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Hebdomadaire',
  biweekly: 'Bimensuelle',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  custom: 'Personnalisée',
}

export default async function GroupsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: groups, error } = await supabase
    .from('tontine_groups')
    .select('id, name, description, contribution_amount, currency, frequency, status, members(count)')
    .order('created_at', { ascending: false })

  if (error) {
    // Exigence 22.2 : message lisible, sans détail technique.
    return (
      <EmptyState
        title="Chargement impossible"
        description="Vos groupes n’ont pas pu être récupérés. Rechargez la page."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Groupes de cotisation</h1>
        <Link
          href="/groups/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus className="size-4" /> Nouveau groupe
        </Link>
      </div>

      {!groups?.length ? (
        <EmptyState
          title="Aucun groupe"
          description="Créez votre premier groupe pour commencer à gérer une tontine."
          action={
            <Link
              href="/groups/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
            >
              <Plus className="size-4" /> Nouveau groupe
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="block h-full">
                <Card className="h-full transition-colors hover:border-primary-400">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{g.name}</p>
                    <Badge tone={g.status === 'active' ? 'success' : 'neutral'}>
                      {g.status === 'active' ? 'Active' : g.status}
                    </Badge>
                  </div>
                  {g.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {g.description}
                    </p>
                  )}
                  <dl className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Cotisation</dt>
                      <dd className="font-medium">
                        {formatMoney(Number(g.contribution_amount), g.currency)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Fréquence</dt>
                      <dd>{FREQUENCY_LABEL[g.frequency] ?? g.frequency}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Membres</dt>
                      <dd>
                        {(g.members as unknown as { count: number }[])[0]?.count ?? 0}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
