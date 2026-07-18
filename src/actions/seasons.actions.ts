'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin, requireProfile } from '@/lib/auth/dal'
import { toFieldErrors } from '@/lib/form-errors'
import { createClient } from '@/lib/supabase/server'
import { seasonSchema } from '@/lib/validators'

export type ActionState = {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

export async function createSeason(
  groupId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const parsed = seasonSchema.safeParse({
    name: formData.get('name'),
    year: formData.get('year'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
  })
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error.issues) }
  }
  const d = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('seasons')
    .insert({
      group_id: groupId,
      name: d.name,
      year: d.year,
      start_date: d.startDate,
      end_date: d.endDate,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 : soit le nom existe déjà, soit l'index partiel
    // unique_open_season_per_group refuse une 2e saison ouverte.
    if (error.code === '23505') {
      return {
        error:
          'Une saison porte déjà ce nom, ou une saison est déjà en cours pour ce groupe.',
      }
    }
    return { error: 'Impossible de créer la saison.' }
  }

  revalidatePath(`/groups/${groupId}`)
  redirect(`/groups/${groupId}/seasons/${data.id}`)
}

/*
 * Les quatre générateurs délèguent à des fonctions PostgreSQL. Le calcul vit en
 * base, et non ici, pour trois raisons : l'atomicité (l'ordre est écrit dans une
 * seule transaction), l'aléa cryptographique côté serveur, et l'impossibilité
 * pour un client de forger un ordre en écrivant directement dans la table —
 * aucune policy INSERT n'existe sur beneficiary_orders.
 */

type RpcResult = { success: boolean; message: string }

async function callGenerator(
  fn: string,
  args: Record<string, unknown>,
  groupId: string,
  seasonId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(fn, args)

  if (error) {
    return { error: error.message }
  }

  const result = (Array.isArray(data) ? data[0] : data) as RpcResult | undefined
  if (!result) {
    return { error: 'Réponse inattendue du serveur.' }
  }
  if (!result.success) {
    return { error: result.message }
  }

  revalidatePath(`/groups/${groupId}/seasons/${seasonId}`)
  revalidatePath(`/groups/${groupId}`)
  return { success: result.message }
}

/** Exigence 7 : mélange automatique. */
export async function generateAutomaticShuffle(
  groupId: string,
  seasonId: string,
): Promise<ActionState> {
  await requireAdmin()
  return callGenerator(
    'generate_automatic_shuffle',
    { p_season_id: seasonId },
    groupId,
    seasonId,
  )
}

/** Exigence 8 : ordre manuel (drag & drop). */
export async function generateManualOrder(
  groupId: string,
  seasonId: string,
  memberIds: string[],
): Promise<ActionState> {
  await requireAdmin()
  return callGenerator(
    'generate_manual_order',
    { p_season_id: seasonId, p_member_ids: memberIds },
    groupId,
    seasonId,
  )
}

/** Exigence 9 : rotation basée sur la saison précédente. */
export async function generateIntelligentRotation(
  groupId: string,
  seasonId: string,
): Promise<ActionState> {
  await requireAdmin()
  return callGenerator(
    'generate_intelligent_rotation',
    { p_season_id: seasonId },
    groupId,
    seasonId,
  )
}

/** Exigence 6 : ouvre le tirage individuel aux membres. */
export async function openIndividualDrawing(
  groupId: string,
  seasonId: string,
): Promise<ActionState> {
  await requireAdmin()
  return callGenerator(
    'open_individual_drawing',
    { p_season_id: seasonId },
    groupId,
    seasonId,
  )
}

/** Clôture une saison finalisée (active -> completed). Rend la rotation possible. */
export async function completeSeason(
  groupId: string,
  seasonId: string,
): Promise<ActionState> {
  await requireAdmin()
  return callGenerator('complete_season', { p_season_id: seasonId }, groupId, seasonId)
}

/** Annule un tirage ouvert et ramène la saison en brouillon. */
export async function cancelDrawing(
  groupId: string,
  seasonId: string,
): Promise<ActionState> {
  await requireAdmin()
  return callGenerator('cancel_drawing', { p_season_id: seasonId }, groupId, seasonId)
}

/**
 * Tirage d'un membre. Aucun identifiant de membre n'est transmis : la fonction
 * SQL le déduit de auth.uid(), donc on ne peut pas tirer à la place d'autrui.
 */
export async function drawMyNumber(
  seasonId: string,
): Promise<{ drawnNumber?: number; error?: string }> {
  await requireProfile()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('perform_individual_drawing', {
    p_season_id: seasonId,
  })

  if (error) return { error: error.message }

  const result = (Array.isArray(data) ? data[0] : data) as
    | { drawn_number: number | null; success: boolean; message: string }
    | undefined

  if (!result?.success) {
    return { error: result?.message ?? 'Le tirage a échoué.' }
  }

  revalidatePath(`/draw/${seasonId}`)
  return { drawnNumber: result.drawn_number ?? undefined }
}
