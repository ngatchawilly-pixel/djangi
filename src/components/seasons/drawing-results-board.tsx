'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { Badge, Card } from '@/components/ui'

type Member = { id: string; name: string }

/**
 * Tableau des résultats du tirage, visible par tous les participants : chacun
 * voit en direct les numéros déjà tirés par les autres.
 *
 * RLS autorise un membre à lire tous les tirages de son groupe
 * (drawings_select_member). Le temps réel dépend de l'activation de Realtime sur
 * la table `drawings` (cf. README) ; sans lui, le tableau affiche l'état au
 * chargement et se met à jour à chaque rafraîchissement de page.
 */
export function DrawingResultsBoard({
  seasonId,
  initialMembers,
  initialDrawn,
}: {
  seasonId: string
  initialMembers: Member[]
  initialDrawn: Record<string, number>
}) {
  const [drawn, setDrawn] = useState<Record<string, number>>(initialDrawn)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function refresh() {
      const { data } = await supabase
        .from('drawings')
        .select('member_id, drawn_number')
        .eq('season_id', seasonId)
      if (cancelled || !data) return
      setDrawn(Object.fromEntries(data.map((d) => [d.member_id, d.drawn_number])))
    }

    const channel = supabase
      .channel(`draw-board:${seasonId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'drawings',
          filter: `season_id=eq.${seasonId}`,
        },
        () => refresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [seasonId])

  const total = initialMembers.length
  const completed = Object.keys(drawn).length

  // Les membres ayant tiré remontent en tête, triés par numéro ; le reste par nom.
  const rows = useMemo(
    () =>
      [...initialMembers].sort((a, b) => {
        const na = drawn[a.id]
        const nb = drawn[b.id]
        if (na != null && nb != null) return na - nb
        if (na != null) return -1
        if (nb != null) return 1
        return a.name.localeCompare(b.name)
      }),
    [initialMembers, drawn],
  )

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="font-medium">Résultats en direct</p>
        <span className="text-sm tabular-nums text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm">{m.name}</span>
            {drawn[m.id] != null ? (
              <Badge tone="success">N° {drawn[m.id]}</Badge>
            ) : (
              <Badge tone="neutral">en attente</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
