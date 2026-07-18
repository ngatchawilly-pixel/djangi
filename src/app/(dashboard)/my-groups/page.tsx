import Link from 'next/link'
import { ChevronRight, Dices } from 'lucide-react'

import { requireProfile } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

export default async function MyGroupsPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  // Fiches membres rattachées à ce compte (par email, cf. handle_new_user).
  const { data: memberships } = await supabase
    .from('members')
    .select('id, group_id, status, tontine_groups(id, name, contribution_amount, currency)')
    .eq('user_id', profile.id)

  if (!memberships?.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mes participations</h1>
        <EmptyState
          title="Vous ne participez à aucune tontine"
          description={`Aucune fiche membre n’est rattachée à ${profile.email}. Demandez à l’administrateur de votre groupe de vous inscrire avec cette adresse exacte.`}
        />
      </div>
    )
  }

  const groupIds = memberships.map((m) => m.group_id)

  // Simple indicateur « tirage en cours » par groupe : le détail (et l'action)
  // se trouve à l'intérieur du groupe, pas ici.
  const { data: drawingSeasons } = await supabase
    .from('seasons')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('status', 'drawing')

  const groupsWithOpenDraw = new Set(drawingSeasons?.map((s) => s.group_id) ?? [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes participations</h1>
        <p className="text-sm text-muted-foreground">
          Ouvrez un groupe pour voir son actualité et, le cas échéant, tirer votre numéro.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {memberships.map((m) => {
          const g = m.tontine_groups as unknown as {
            id: string
            name: string
            contribution_amount: number
            currency: string
          }
          const hasOpenDraw = groupsWithOpenDraw.has(m.group_id)
          return (
            <li key={m.id}>
              <Link href={`/my-groups/${m.group_id}`} className="block h-full">
                <Card className="flex h-full items-center gap-3 transition-colors hover:border-primary-400">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{g.name}</p>
                      {hasOpenDraw && (
                        <Badge tone="warning">
                          <Dices className="mr-1 size-3" /> Tirage en cours
                        </Badge>
                      )}
                      <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
                        {m.status === 'active' ? 'Actif' : m.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cotisation {formatMoney(Number(g.contribution_amount), g.currency)}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
