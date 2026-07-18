'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { cancelDrawing, completeSeason } from '@/actions/seasons.actions'
import { Alert, Button } from '@/components/ui'

/**
 * Boutons de transition de cycle de vie d'une saison :
 *   * « active »  -> proposer la clôture (permet la rotation suivante)
 *   * « drawing » -> proposer l'annulation du tirage
 * Le composant ne s'affiche que pour ces deux statuts (décidé par le parent).
 */
export function SeasonLifecycleActions({
  groupId,
  seasonId,
  kind,
}: {
  groupId: string
  seasonId: string
  kind: 'complete' | 'cancel-drawing'
}) {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function run() {
    const confirmMsg =
      kind === 'complete'
        ? 'Clôturer cette saison ? Elle deviendra la base d’une éventuelle rotation, et ne pourra plus servir de saison active.'
        : 'Annuler le tirage en cours ? Tous les numéros déjà tirés seront effacés et la saison repassera en brouillon.'
    if (!confirm(confirmMsg)) return

    setError(undefined)
    startTransition(async () => {
      const res =
        kind === 'complete'
          ? await completeSeason(groupId, seasonId)
          : await cancelDrawing(groupId, seasonId)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-2">
      {error && <Alert>{error}</Alert>}
      <Button variant={kind === 'complete' ? 'secondary' : 'danger'} onClick={run} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : kind === 'complete' ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <XCircle className="size-4" />
        )}
        {kind === 'complete' ? 'Clôturer la saison' : 'Annuler le tirage'}
      </Button>
    </div>
  )
}
