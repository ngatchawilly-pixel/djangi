'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/dal'
import { toFieldErrors } from '@/lib/form-errors'
import { createClient } from '@/lib/supabase/server'
import { groupSchema } from '@/lib/validators'

export type ActionState = { error?: string; fieldErrors?: Record<string, string> }

function parseGroupForm(formData: FormData) {
  return groupSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    contributionAmount: formData.get('contributionAmount'),
    frequency: formData.get('frequency'),
    currency: formData.get('currency'),
    location: formData.get('location'),
    meetingTime: formData.get('meetingTime'),
  })
}

export async function createGroup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireAdmin()
  const parsed = parseGroupForm(formData)
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }
  const d = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tontine_groups')
    .insert({
      admin_id: profile.id,
      name: d.name,
      description: d.description || null,
      contribution_amount: d.contributionAmount,
      frequency: d.frequency,
      currency: d.currency,
      location: d.location || null,
      meeting_time: d.meetingTime || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { name: 'Vous avez déjà un groupe portant ce nom' } }
    }
    return { error: "Impossible de créer le groupe. Réessayez." }
  }

  revalidatePath('/groups')
  redirect(`/groups/${data.id}`)
}

export async function updateGroup(
  groupId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const parsed = parseGroupForm(formData)
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }
  const d = parsed.data

  const supabase = await createClient()
  // Pas de filtre admin_id ici : c'est la policy RLS groups_update_admin qui
  // décide. Un groupe d'un autre admin renvoie simplement 0 ligne.
  const { error } = await supabase
    .from('tontine_groups')
    .update({
      name: d.name,
      description: d.description || null,
      contribution_amount: d.contributionAmount,
      frequency: d.frequency,
      currency: d.currency,
      location: d.location || null,
      meeting_time: d.meetingTime || null,
    })
    .eq('id', groupId)

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { name: 'Vous avez déjà un groupe portant ce nom' } }
    }
    return { error: 'Impossible de mettre à jour le groupe.' }
  }

  revalidatePath('/groups')
  revalidatePath(`/groups/${groupId}`)
  redirect(`/groups/${groupId}`)
}

export async function deleteGroup(groupId: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('tontine_groups').delete().eq('id', groupId)
  revalidatePath('/groups')
  redirect('/groups')
}
