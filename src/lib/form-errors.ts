/**
 * Aplatit les erreurs Zod en une map champ -> premier message, consommable par
 * les formulaires (exigence 22.1 : une erreur affichée sous son champ).
 *
 * Zod v4 type `path` en `PropertyKey[]`, qui peut contenir des symboles ; on
 * ne garde que les clés adressables depuis le DOM.
 */
export function toFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const head = issue.path[0]
    const key =
      typeof head === 'string' || typeof head === 'number' ? String(head) : '_'
    out[key] ??= issue.message
  }
  return out
}
