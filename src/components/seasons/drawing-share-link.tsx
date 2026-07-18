'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button, Card } from '@/components/ui'

/**
 * L'admin n'avait aucun moyen de transmettre le lien de tirage à ses membres :
 * la page /draw/[seasonId] n'était atteignable que depuis « Mes participations »,
 * donc invisible pour lui.
 *
 * L'URL est construite côté client (window.location.origin) : en Server
 * Component il faudrait lire l'en-tête Host, peu fiable derrière un proxy.
 */
export function DrawingShareLink({ seasonId }: { seasonId: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setUrl(`${window.location.origin}/draw/${seasonId}`)
  }, [seasonId])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers refusé (hors HTTPS, permission) : l'input reste
      // sélectionnable à la main, donc rien de bloquant.
    }
  }

  return (
    <Card>
      <p className="font-medium">Lien de tirage à partager</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Envoyez ce lien à vos membres. Chacun devra être connecté avec l’email que
        vous avez saisi sur sa fiche.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Lien de tirage"
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 flex-1 rounded-lg border border-border bg-muted px-3 font-mono text-sm"
        />
        <Button variant="secondary" onClick={copy} className="shrink-0">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
    </Card>
  )
}
