'use server'

import { revalidatePath } from 'next/cache'

import { toFieldErrors } from '@/lib/form-errors'
import { createClient } from '@/lib/supabase/server'
import { profileSchema } from '@/lib/validators'

export type ActionState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Session expirée. Reconnectez-vous.' }
  }

  // RLS profiles_update_own limite à sa propre ligne ; le trigger d'immuabilité
  // du rôle empêche toute élévation. On ne touche pas au rôle ni à l'email ici.
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone || null,
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'Impossible de mettre à jour le profil.' }
  }

  // Rafraîchit le nom affiché dans l'en-tête.
  revalidatePath('/', 'layout')
  revalidatePath('/settings')
  return { success: 'Profil mis à jour.' }
}
