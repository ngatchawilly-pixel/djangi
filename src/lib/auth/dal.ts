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
