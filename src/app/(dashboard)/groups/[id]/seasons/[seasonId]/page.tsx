import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { requireAdmin } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { OrderGenerator } from '@/components/seasons/order-generator'
import { DrawingStatus } from '@/components/seasons/drawing-status'
import { Badge, Card } from '@/components/ui'
import { formatDate, fullName } from '@/lib/utils'

const MODE_LABEL: Record<string, string> = {
  individual_drawing: 'Tirage individuel',
  automatic_shuffle: 'Mélange automatique',
  manual: 'Ordre manuel',
  intelligent_rotation: 'Rotation intelligente',
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>
}) {
  const { id, seasonId } = await params
  await requireAdmin()
  const supabase = await createClient()

  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, year, start_date, end_date, status, generation_mode, expected_member_count, finalized_at')
    .eq('id', seasonId)
    .eq('group_id', id)
    .single()

  if (!season) notFound()

  const { data: activeMembers } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .eq('group_id', id)
    .eq('status', 'active')
    .order('created_at')

  // L'ordre finalisé, avec le nom des membres.
  const { data: order } = await supabase
    .from('beneficiary_orders')
    .select('position, members(id, first_name, last_name)')
    .eq('season_id', seasonId)
    .order('position')

  // Une saison précédente terminée est nécessaire pour la rotation (ex. 9.6).
  const { count: completedCount } = await supabase
    .from('seasons')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)
    .eq('status', 'completed')

  const isFinalized = season.status === 'active' || season.status === 'completed'

  return (
    <div className="space-y-6">
      <Link
        href={`/groups/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Retour au groupe
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {season.name} <span className="text-muted-foreground">· {season.year}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Du {formatDate(season.start_date)} au {formatDate(season.end_date)}
          </p>
        </div>
        <Badge
          tone={
            season.status === 'active'
              ? 'success'
              : season.status === 'drawing'
                ? 'warning'
                : 'neutral'
          }
        >
          {season.status === 'draft' && 'Brouillon'}
          {season.status === 'drawing' && 'Tirage en cours'}
          {season.status === 'active' && 'Ordre finalisé'}
          {season.status === 'completed' && 'Terminée'}
          {season.status === 'cancelled' && 'Annulée'}
        </Badge>
      </div>

      {season.status === 'drawing' && (
        <DrawingStatus seasonId={seasonId} groupId={id} />
      )}

      {season.status === 'draft' && (
        <OrderGenerator
          groupId={id}
          seasonId={seasonId}
          members={(activeMembers ?? []).map((m) => ({
            id: m.id,
            name: fullName(m),
          }))}
          hasPreviousSeason={(completedCount ?? 0) > 0}
        />
      )}

      {isFinalized && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Ordre de passage</h2>
            {season.generation_mode && (
              <span className="text-sm text-muted-foreground">
                {MODE_LABEL[season.generation_mode]}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            L’ordre est verrouillé depuis le{' '}
            {season.finalized_at ? formatDate(season.finalized_at) : '—'}. Il ne peut
            plus être modifié.
          </p>

          <Card className="p-0">
            <ol className="divide-y divide-border">
              {order?.map((row) => {
                const m = row.members as unknown as {
                  id: string
                  first_name: string
                  last_name: string
                }
                return (
                  <li key={row.position} className="flex items-center gap-4 p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-sm font-semibold text-primary-600">
                      {row.position}
                    </span>
                    <span className="font-medium">{fullName(m)}</span>
                  </li>
                )
              })}
            </ol>
          </Card>
        </section>
      )}
    </div>
  )
}
