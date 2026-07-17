import { notFound } from 'next/navigation'

import { updateGroup } from '@/actions/groups.actions'
import { requireAdmin } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { GroupForm } from '@/components/groups/group-form'
import { Card } from '@/components/ui'

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdmin()
  const supabase = await createClient()

  const { data: group } = await supabase
    .from('tontine_groups')
    .select('name, description, contribution_amount, currency, frequency, location, meeting_time')
    .eq('id', id)
    .single()

  if (!group) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Modifier le groupe</h1>
      <Card>
        <GroupForm
          action={updateGroup.bind(null, id)}
          defaults={{
            ...group,
            contribution_amount: Number(group.contribution_amount),
          }}
          submitLabel="Enregistrer"
          cancelHref={`/groups/${id}`}
        />
      </Card>
    </div>
  )
}
