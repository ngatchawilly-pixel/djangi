import { notFound } from 'next/navigation'

import { requireProfile } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { DrawingInterface } from '@/components/seasons/drawing-interface'
import { DrawingResultsBoard } from '@/components/seasons/drawing-results-board'
import { fullName } from '@/lib/utils'

export default async function DrawPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  const profile = await requireProfile()
  const supabase = await createClient()

  // RLS : un non-membre du groupe ne voit tout simplement pas la saison.
  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, year, status, group_id')
    .eq('id', seasonId)
    .single()

  if (!season) notFound()

  const { data: membership } = await supabase
    .from('members')
    .select('id')
    .eq('group_id', season.group_id)
    .eq('user_id', profile.id)
    .maybeSingle()

  const { data: existing } = membership
    ? await supabase
        .from('drawings')
        .select('drawn_number')
        .eq('season_id', seasonId)
        .eq('member_id', membership.id)
        .maybeSingle()
    : { data: null }

  // Tous les participants et l'état du tirage, pour le tableau en direct.
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .eq('group_id', season.group_id)
    .eq('status', 'active')
    .order('created_at')

  const { data: allDrawings } = await supabase
    .from('drawings')
    .select('member_id, drawn_number')
    .eq('season_id', seasonId)

  const showBoard =
    (season.status === 'drawing' || season.status === 'active') && !!members?.length

  return (
    <div className="mx-auto max-w-md space-y-8">
      <DrawingInterface
        seasonId={seasonId}
        seasonLabel={`${season.name} · ${season.year}`}
        isOpen={season.status === 'drawing'}
        isMember={!!membership}
        alreadyDrawn={existing?.drawn_number ?? null}
      />

      {showBoard && (
        <DrawingResultsBoard
          seasonId={seasonId}
          initialMembers={members!.map((m) => ({ id: m.id, name: fullName(m) }))}
          initialDrawn={Object.fromEntries(
            (allDrawings ?? []).map((d) => [d.member_id, d.drawn_number]),
          )}
        />
      )}
    </div>
  )
}
