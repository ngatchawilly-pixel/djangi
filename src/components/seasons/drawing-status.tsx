'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui'

type Progress = { total: number; completed: number; is_complete: boolean }

/**
 * Exigence 6.7 : l'admin voit en temps réel qui a tiré.
 *
 * Realtime doit être activé sur la table `drawings` côté Supabase (voir README).
 * Si le canal n'est pas disponible, la barre reste juste figée jusqu'au prochain
 * rafraîchissement : pas de dégradation bloquante.
 */
export function DrawingStatus({
  seasonId,
  groupId,
}: {
  seasonId: string
  groupId: string
}) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function refresh() {
      const { data } = await supabase.rpc('drawing_progress', {
        p_season_id: seasonId,
      })
      const row = (Array.isArray(data) ? data[0] : data) as Progress | undefined
      if (cancelled || !row) return

      setProgress(row)
      // Le dernier tirage finalise l'ordre côté base : on recharge pour
      // basculer la page en vue « ordre finalisé ».
      if (row.is_complete) router.refresh()
    }

    refresh()

    const channel = supabase
      .channel(`drawings:${seasonId}`)
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
  }, [seasonId, groupId, router])

  const total = progress?.total ?? 0
  const completed = progress?.completed ?? 0
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Tirage en cours</p>
          <p className="text-sm text-muted-foreground">
            Chaque membre tire son numéro depuis son espace.
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">
          {completed}/{total}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avancement du tirage"
        className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  )
}
