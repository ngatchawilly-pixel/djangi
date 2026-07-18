import { notFound } from 'next/navigation'

import { createSeason } from '@/actions/seasons.actions'
import { requireGroupOwner } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { SeasonForm } from '@/components/seasons/season-form'
import { Alert, Card } from '@/components/ui'

export default async function NewSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireGroupOwner(id)
  const supabase = await createClient()

  const { data: group } = await supabase
    .from('tontine_groups')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!group) notFound()

  const { count } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)
    .eq('status', 'active')

  const activeCount = count ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle saison</h1>
        <p className="text-sm text-muted-foreground">{group.name}</p>
      </div>

      {activeCount < 2 ? (
        <Alert>
          Ce groupe compte {activeCount} membre actif. Il en faut au moins 2 pour
          générer un ordre de passage. Ajoutez des membres avant de créer une saison.
        </Alert>
      ) : (
        <Card>
          <p className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            La saison comptera <strong>{activeCount} tours</strong>, un par membre
            actif. Vous choisirez l’ordre de passage juste après.
          </p>
          <SeasonForm
            action={createSeason.bind(null, id)}
            cancelHref={`/groups/${id}`}
          />
        </Card>
      )}
    </div>
  )
}
