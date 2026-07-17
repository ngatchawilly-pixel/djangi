import Link from 'next/link'
import { Dices } from 'lucide-react'

import { requireProfile } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

export default async function MyGroupsPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  // Fiches membres rattachées à ce compte (via handle_new_user, par email).
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

  // Saisons ouvertes au tirage dans ces groupes.
  const { data: drawingSeasons } = await supabase
    .from('seasons')
    .select('id, name, year, group_id, status')
    .in('group_id', groupIds)
    .eq('status', 'drawing')

  // Numéros déjà tirés par ce membre.
  const { data: myDrawings } = await supabase
    .from('drawings')
    .select('season_id, drawn_number')
    .in(
      'member_id',
      memberships.map((m) => m.id),
    )

  const drawnBySeason = new Map(
    myDrawings?.map((d) => [d.season_id, d.drawn_number]) ?? [],
  )

  // Positions finalisées.
  const { data: positions } = await supabase
    .from('beneficiary_orders')
    .select('position, season_id, member_id, seasons(name, year, group_id, status)')
    .in(
      'member_id',
      memberships.map((m) => m.id),
    )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mes participations</h1>

      {!!drawingSeasons?.length && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Tirage ouvert</h2>
          {drawingSeasons.map((s) => {
            const already = drawnBySeason.get(s.id)
            return (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {s.name} · {s.year}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {already
                      ? `Vous avez tiré le numéro ${already}.`
                      : 'Vous n’avez pas encore tiré votre numéro.'}
                  </p>
                </div>
                {already ? (
                  <Badge tone="success">Numéro {already}</Badge>
                ) : (
                  <Link
                    href={`/draw/${s.id}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
                  >
                    <Dices className="size-4" /> Tirer mon numéro
                  </Link>
                )}
              </Card>
            )
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mes groupes</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {memberships.map((m) => {
            const g = m.tontine_groups as unknown as {
              id: string
              name: string
              contribution_amount: number
              currency: string
            }
            const pos = positions?.find(
              (p) =>
                (p.seasons as unknown as { group_id: string })?.group_id === m.group_id,
            )
            return (
              <li key={m.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{g.name}</p>
                    <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
                      {m.status === 'active' ? 'Actif' : m.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cotisation {formatMoney(Number(g.contribution_amount), g.currency)}
                  </p>
                  {pos && (
                    <p className="mt-3 text-sm">
                      Votre position :{' '}
                      <strong className="text-primary-600">#{pos.position}</strong>
                    </p>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
