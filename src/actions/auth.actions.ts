'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
} from '@/lib/validators'
import { toFieldErrors } from '@/lib/form-errors'
import { createClient } from '@/lib/supabase/server'

export type ActionState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // « Email non confirmé » est distingué du reste : c'est une impasse que
    // l'utilisateur ne peut pas résoudre seul s'il ne sait pas ce qui bloque.
    // Cela révèle que le compte existe, mais quiconque voit ce message vient
    // justement de tenter de le créer — la fuite est théorique.
    if (error.code === 'email_not_confirmed') {
      return {
        error:
          'Votre adresse email n’est pas confirmée. Vérifiez le lien reçu par email.',
      }
    }
    // Exigence 1.3 : message explicite, mais sans révéler si l'email existe.
    return { error: 'Email ou mot de passe incorrect' }
  }

  const redirectTo = String(formData.get('redirectTo') || '/dashboard')
  revalidatePath('/', 'layout')
  redirect(redirectTo.startsWith('/') ? redirectTo : '/dashboard')
}

export async function register(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Lues par handle_new_user(). Le rôle y est filtré côté base : impossible
      // d'obtenir 'Super_Admin' en trafiquant ce formulaire.
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        role: parsed.data.role,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return {
    success:
      'Compte créé. Vérifiez votre boîte mail si une confirmation est demandée, puis connectez-vous.',
  }
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const origin = (await headers()).get('origin') ?? ''

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Réponse identique que l'email existe ou non : évite l'énumération de comptes.
  return {
    success:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.',
  }
}

export async function updatePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) {
    return { error: 'Minimum 8 caractères' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  redirect('/dashboard')
}

/**
 * Changement de mot de passe par un utilisateur connecté (exigence 1.5).
 * On revérifie le mot de passe actuel avant d'en poser un nouveau : sans ça,
 * quiconque accède à une session ouverte pourrait le changer sans le connaître.
 */
export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: 'Session expirée. Reconnectez-vous.' }
  }

  // Re-preuve d'identité : une tentative de connexion avec le mot de passe actuel.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  })
  if (verifyError) {
    return { fieldErrors: { currentPassword: 'Mot de passe actuel incorrect' } }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (error) {
    return { error: 'Impossible de mettre à jour le mot de passe.' }
  }

  return { success: 'Votre mot de passe a été mis à jour.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
