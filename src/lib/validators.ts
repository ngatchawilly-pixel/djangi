import { z } from 'zod'

/*
 * Schémas partagés : le même objet valide côté client (retour immédiat, ex. 22.4)
 * et côté serveur dans les Server Actions (ex. 22.5 — la validation serveur ne
 * fait jamais confiance au client). La base repose ensuite ses propres CHECK.
 */

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    email: z.string().email('Adresse email invalide'),
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirmPassword: z.string(),
    // Un compte administrateur gère ses propres tontines ; un compte membre
    // rejoint celles où un admin l'a inscrit. 'Super_Admin' n'est pas
    // attribuable ici — le trigger handle_new_user() le filtre de toute façon.
    role: z.enum(['Admin', 'Member']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Adresse email invalide'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(8, 'Minimum 8 caractères'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'Le nouveau mot de passe doit être différent de l’actuel',
    path: ['newPassword'],
  })

export const groupSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(120),
  description: z.string().max(1000).optional().or(z.literal('')),
  // Zod v4 : `error` remplace `invalid_type_error`.
  contributionAmount: z.coerce
    .number({ error: 'Montant invalide' })
    .positive('Le montant doit être positif'), // exigence 3.6
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'custom']),
  currency: z.string().min(3).max(3).default('XAF'),
  location: z.string().max(200).optional().or(z.literal('')),
  meetingTime: z.string().optional().or(z.literal('')),
})

// Exigence 4.7. Doit rester cohérent avec check_member_phone_format en SQL.
const phoneRegex = /^\+?[0-9][0-9 .-]{6,19}$/

export const memberSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis').max(80),
  lastName: z.string().min(1, 'Nom requis').max(80),
  email: z
    .string()
    .email('Adresse email invalide')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(phoneRegex, 'Numéro invalide (ex. +237 6 12 34 56 78)')
    .optional()
    .or(z.literal('')),
  gender: z
    .enum(['male', 'female', 'other', 'prefer_not_to_say'])
    .optional()
    .or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  profession: z.string().max(120).optional().or(z.literal('')),
  entryDate: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'suspended', 'excluded', 'left']).default('active'),
})

export const profileSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis').max(80),
  lastName: z.string().min(1, 'Nom requis').max(80),
  phone: z
    .string()
    .regex(phoneRegex, 'Numéro invalide (ex. +237 6 12 34 56 78)')
    .optional()
    .or(z.literal('')),
})

export const seasonSchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(120),
    year: z.coerce.number().int().min(2020).max(2100),
    startDate: z.string().min(1, 'Date de début requise'),
    endDate: z.string().min(1, 'Date de fin requise'),
  })
  // Exigence 5.3
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['endDate'],
  })

export const generationModeSchema = z.enum([
  'individual_drawing',
  'automatic_shuffle',
  'manual',
  'intelligent_rotation',
])

export type GroupInput = z.infer<typeof groupSchema>
export type MemberInput = z.infer<typeof memberSchema>
export type SeasonInput = z.infer<typeof seasonSchema>
export type GenerationMode = z.infer<typeof generationModeSchema>
