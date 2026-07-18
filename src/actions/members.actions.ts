'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/dal'
import { toFieldErrors } from '@/lib/form-errors'
import { createClient } from '@/lib/supabase/server'
import { memberSchema } from '@/lib/validators'

export type ActionState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

function parse(formData: FormData) {
  return memberSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    gender: formData.get('gender'),
    birthDate: formData.get('birthDate'),
    profession: formData.get('profession'),
    entryDate: formData.get('entryDate'),
    status: formData.get('status') ?? 'active',
  })
}

export async function addMember(
  groupId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const parsed = parse(formData)
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('members').insert({
    group_id: groupId,
    first_name: d.firstName,
    last_name: d.lastName,
    email: d.email || null,
    phone: d.phone || null,
    gender: d.gender || null,
    birth_date: d.birthDate || null,
    profession: d.profession || null,
    entry_date: d.entryDate || new Date().toISOString().slice(0, 10),
    status: d.status,
  })

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { email: 'Cet email est déjà utilisé dans ce groupe' } }
    }
    if (error.code === '23514') {
      return { error: 'Format d’email ou de téléphone invalide.' }
    }
    // 42501 = RLS refuse : le groupe n'appartient pas à cet admin.
    if (error.code === '42501') {
      return { error: 'Vous n’avez pas accès à ce groupe.' }
    }
    return { error: 'Impossible d’ajouter ce membre.' }
  }

  revalidatePath(`/groups/${groupId}`)
  return { success: `${d.firstName} ${d.lastName} a été ajouté.` }
}

export type LookupResult = {
  found: boolean
  firstName?: string
  lastName?: string
  error?: string
}

/**
 * Recherche un compte par email EXACT (voir migration 5). Sert à pré-remplir la
 * fiche et à confirmer que la personne pourra tirer son numéro. Le rattachement
 * réel reste fait par le trigger à l'insertion — cette fonction n'écrit rien.
 */
export async function lookupUserByEmail(email: string): Promise<LookupResult> {
  await requireAdmin()

  const trimmed = email.trim()
  if (!trimmed) return { found: false }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('lookup_user_by_email', {
    p_email: trimmed,
  })

  if (error) return { found: false, error: 'La recherche a échoué.' }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { found: boolean; first_name: string | null; last_name: string | null }
    | undefined

  if (!row?.found) return { found: false }
  return {
    found: true,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
  }
}

export async function updateMemberStatus(
  memberId: string,
  groupId: string,
  status: 'active' | 'suspended' | 'excluded' | 'left',
) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('members').update({ status }).eq('id', memberId)
  revalidatePath(`/groups/${groupId}`)
}

export async function removeMember(memberId: string, groupId: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('members').delete().eq('id', memberId)
  revalidatePath(`/groups/${groupId}`)
}
