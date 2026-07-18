import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Dices } from 'lucide-react'

import { requireProfile } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

export default async function MyGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await requireProfile()
  const supabase = await createClient()

  // La fiche de CE membre dans CE groupe. RLS ne renvoie rien s'il n'y participe
  // pas : indiscernable d'un groupe inexistant, donc notFound().
  const { data: membership } = await supabase
    .from('members')
    .select('id, status, tontine_groups(id, name, description, contribution_amount, currency, frequency)')
    .eq('group_id', id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!membership) notFound()

  const g = membership.tontine_groups as unknown as {
    id: string
    name: string
    description: string | null
    contribution_amount: number
    currency: string
    frequency: string
  }

  // La saison en cours du groupe : celle qui n'est ni terminée ni annulée.
  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, year, status')
    .eq('group_id', id)
    .in('status', ['draft', 'drawing', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Le tirage de ce membre pour cette saison, s'il existe.
  const myDrawing =
    season &&
    (
      await supabase
        .from('drawings')
        .select('drawn_number')
        .eq('season_id', season.id)
        .eq('member_id', membership.id)
        .maybeSingle()
    ).data

  // Sa position dans l'ordre finalisé, s'il existe.
  const myPosition =
    season && season.status === 'active'
      ? (
          await supabase
            .from('beneficiary_orders')
            .select('position')
            .eq('season_id', season.id)
            .eq('member_id', membership.id)
            .maybeSingle()
        ).data
      : null

  return (
    <div className="space-y-6">
      <Link
        href="/my-groups"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes participations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{g.name}</h1>
          {g.description && (
            <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
          )}
        </div>
        <Badge tone={membership.status === 'active' ? 'success' : 'neutral'}>
          {membership.status === 'active' ? 'Membre actif' : membership.status}
        </Badge>
      </div>

      <Card>
        <p className="text-sm text-muted-foreground">Cotisation</p>
        <p className="mt-1 text-xl font-semibold">
          {formatMoney(Number(g.contribution_amount), g.currency)}
        </p>
      </Card>

      {/* Tirage : visible seulement une fois dans le groupe -------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tirage de numéro</h2>

        {!season || season.status === 'draft' ? (
          <EmptyState
            title="Aucun tirage en cours"
            description="Quand l’organisateur ouvrira le tirage, vous pourrez tirer votre numéro ici."
          />
        ) : season.status === 'drawing' ? (
          myDrawing ? (
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {season.name} · {season.year}
                </p>
                <p className="text-sm text-muted-foreground">
                  Vous avez déjà tiré votre numéro.
                </p>
              </div>
              <Badge tone="success">Numéro {myDrawing.drawn_number}</Badge>
            </Card>
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {season.name} · {season.year}
                </p>
                <p className="text-sm text-muted-foreground">
                  Le tirage est ouvert. À vous de jouer !
                </p>
              </div>
              <Link
                href={`/draw/${season.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
              >
                <Dices className="size-4" /> Tirer mon numéro
              </Link>
            </Card>
          )
        ) : (
          // season.status === 'active' : ordre finalisé
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {season.name} · {season.year}
              </p>
              <p className="text-sm text-muted-foreground">
                L’ordre de passage est finalisé.
              </p>
            </div>
            {myPosition ? (
              <Badge tone="success">Votre position : #{myPosition.position}</Badge>
            ) : (
              <Badge tone="neutral">Vous n’êtes pas dans l’ordre</Badge>
            )}
          </Card>
        )}
      </section>
    </div>
  )
}
