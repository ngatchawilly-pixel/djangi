import { redirect } from 'next/navigation'
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'Super_Admin' | 'Admin' | 'Member'
}

/**
 * Data Access Layer.
 *
 * Le proxy fait une redirection optimiste ; c'est ici que se fait la vérification
 * qui compte côté application. `cache()` déduplique l'appel sur un même rendu.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('id', user.id)
    .single()

  return data as Profile | null
})

/** À appeler en tête de toute page authentifiée. Redirige si non connecté. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

/** Pour les pages réservées aux administrateurs. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== 'Admin' && profile.role !== 'Super_Admin') {
    redirect('/my-groups')
  }
  return profile
}

/**
 * Pour les pages de gestion d'un groupe précis. Le rôle Admin ne suffit pas : il
 * faut être le PROPRIÉTAIRE du groupe. RLS bloque déjà les écritures d'un non-
 * propriétaire, mais sans ce garde la page d'admin s'ouvrait quand même (via la
 * policy « membre »), montrant un formulaire qui échouait à chaque action.
 * Un membre non-propriétaire est renvoyé vers sa vue membre du groupe.
 */
export async function requireGroupOwner(groupId: string): Promise<Profile> {
  const profile = await requireAdmin()
  const supabase = await createClient()
  const { data: group } = await supabase
    .from('tontine_groups')
    .select('admin_id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) redirect('/groups')
  if (group.admin_id !== profile.id && profile.role !== 'Super_Admin') {
    redirect(`/my-groups/${groupId}`)
  }
  return profile
}
