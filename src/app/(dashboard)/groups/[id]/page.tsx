import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarPlus, Pencil } from 'lucide-react'

import { requireAdmin } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { MemberForm } from '@/components/members/member-form'
import { MemberRow } from '@/components/members/member-row'
import { Badge, Card, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/utils'

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Hebdomadaire',
  biweekly: 'Bimensuelle',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  custom: 'Personnalisée',
}

const SEASON_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  drawing: 'Tirage en cours',
  active: 'Active',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

// Next.js 16 : params est une Promise.
export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await requireAdmin()
  const supabase = await createClient()

  const { data: group } = await supabase
    .from('tontine_groups')
    .select('id, name, description, contribution_amount, currency, frequency, location, meeting_time, status')
    .eq('id', id)
    .single()

  // RLS renvoie 0 ligne pour le groupe d'un autre admin : indiscernable d'un
  // groupe inexistant, ce qui est exactement le comportement voulu.
  if (!group) notFound()

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, phone, status, user_id')
    .eq('group_id', id)
    .order('created_at')

  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, year, status, generation_mode, expected_member_count')
    .eq('group_id', id)
    .order('created_at', { ascending: false })

  const activeMembers = members?.filter((m) => m.status === 'active') ?? []
  const openSeason = seasons?.find((s) =>
    ['draft', 'drawing', 'active'].includes(s.status),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        <Link
          href={`/groups/${id}/edit`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-muted"
        >
          <Pencil className="size-4" /> Modifier
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">Cotisation</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(Number(group.contribution_amount), group.currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {FREQUENCY_LABEL[group.frequency] ?? group.frequency}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Membres actifs</p>
          <p className="mt-1 text-xl font-semibold">{activeMembers.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {members?.length ?? 0} au total
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Collecte par tour</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(
              activeMembers.length * Number(group.contribution_amount),
              group.currency,
            )}
          </p>
        </Card>
      </div>

      {/* Saisons -------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Saison et ordre de passage</h2>
          {!openSeason && (
            <Link
              href={`/groups/${id}/seasons/new`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
            >
              <CalendarPlus className="size-4" /> Nouvelle saison
            </Link>
          )}
        </div>

        {!seasons?.length ? (
          <EmptyState
            title="Aucune saison"
            description="Une saison définit le cycle de cotisation et l’ordre de passage des membres."
          />
        ) : (
          <ul className="space-y-2">
            {seasons.map((s) => (
              <li key={s.id}>
                <Link href={`/groups/${id}/seasons/${s.id}`}>
                  <Card className="flex items-center justify-between gap-3 transition-colors hover:border-primary-400">
                    <div>
                      <p className="font-medium">
                        {s.name} <span className="text-muted-foreground">· {s.year}</span>
                      </p>
                      {s.generation_mode && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Ordre : {s.generation_mode.replace('_', ' ')}
                        </p>
                      )}
                    </div>
                    <Badge
                      tone={
                        s.status === 'active'
                          ? 'success'
                          : s.status === 'drawing'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {SEASON_LABEL[s.status] ?? s.status}
                    </Badge>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Membres -------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Membres</h2>

        {!members?.length ? (
          <EmptyState
            title="Aucun membre"
            description="Ajoutez des membres avec le formulaire ci-dessous."
          />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  groupId={id}
                  isCurrentUser={m.user_id === profile.id}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Ajouter un membre</h2>
        <Card>
          <MemberForm groupId={id} />
        </Card>
      </section>
    </div>
  )
}
