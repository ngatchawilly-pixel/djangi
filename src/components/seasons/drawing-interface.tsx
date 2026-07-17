'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { Dices, Loader2 } from 'lucide-react'

import { drawMyNumber } from '@/actions/seasons.actions'
import { Alert, Button, Card } from '@/components/ui'

export function DrawingInterface({
  seasonId,
  seasonLabel,
  isOpen,
  isMember,
  alreadyDrawn,
}: {
  seasonId: string
  seasonLabel: string
  isOpen: boolean
  isMember: boolean
  alreadyDrawn: number | null
}) {
  const [drawn, setDrawn] = useState<number | null>(alreadyDrawn)
  const [error, setError] = useState<string>()
  const [rolling, setRolling] = useState(false)
  const [pending, startTransition] = useTransition()

  function draw() {
    setError(undefined)
    setRolling(true)

    startTransition(async () => {
      const result = await drawMyNumber(seasonId)

      // Défilement de numéros pendant ~1,2 s : le suspense fait partie du rituel
      // de la tontine. Le numéro est déjà décidé côté base, l'animation ne fait
      // que le révéler.
      await new Promise((r) => setTimeout(r, 1200))
      setRolling(false)

      if (result.error) {
        setError(result.error)
        return
      }
      setDrawn(result.drawnNumber ?? null)
    })
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tirage de numéro</h1>
        <p className="text-sm text-muted-foreground">{seasonLabel}</p>
      </div>

      {error && <Alert>{error}</Alert>}

      {!isMember && (
        <Alert>
          Vous n’êtes pas membre de ce groupe, ou votre compte n’y est pas rattaché.
        </Alert>
      )}

      <Card className="flex min-h-56 flex-col items-center justify-center gap-3">
        {drawn !== null ? (
          <>
            <p className="text-6xl" aria-hidden>
              🎉
            </p>
            <p
              className="text-6xl font-bold tabular-nums text-primary-600"
              aria-live="polite"
            >
              {drawn}
            </p>
            <p className="text-sm text-muted-foreground">
              Vous recevrez les fonds au tour n° {drawn}.
            </p>
          </>
        ) : rolling ? (
          <RollingNumber />
        ) : (
          <>
            <p className="text-6xl font-bold text-muted-foreground" aria-hidden>
              ?
            </p>
            <p className="text-sm text-muted-foreground">
              Votre numéro sera révélé ici.
            </p>
          </>
        )}
      </Card>

      {drawn === null && isMember && isOpen && (
        <Button onClick={draw} disabled={pending || rolling} className="w-full">
          {pending || rolling ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Dices className="size-4" />
          )}
          {rolling ? 'Tirage…' : 'Tirer mon numéro'}
        </Button>
      )}

      {!isOpen && drawn === null && (
        <Alert>Le tirage n’est pas ouvert pour cette saison.</Alert>
      )}

      {drawn !== null && (
        <p className="text-sm text-muted-foreground">
          Votre numéro est définitif et ne peut pas être modifié.
        </p>
      )}

      <Link
        href="/my-groups"
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
      >
        Retour à mes participations
      </Link>
    </div>
  )
}

function RollingNumber() {
  const [n, setN] = useState(1)

  // Défilement purement décoratif : Math.random suffit, le vrai numéro vient de
  // la base via un aléa cryptographique.
  useEffect(() => {
    const id = setInterval(() => setN(Math.floor(Math.random() * 30) + 1), 70)
    return () => clearInterval(id)
  }, [])

  return (
    <p className="text-6xl font-bold tabular-nums text-primary-400" aria-hidden>
      {n}
    </p>
  )
}
