'use client'

import { useEffect, useRef } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { changePassword, type ActionState } from '@/actions/auth.actions'
import { Alert, Button, FieldError, Input, Label } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Mise à jour…' : 'Changer le mot de passe'}
    </Button>
  )
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(changePassword, {})
  const formRef = useRef<HTMLFormElement>(null)
  const err = state.fieldErrors ?? {}

  // Vide les champs après un changement réussi.
  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!err.currentPassword}
        />
        <FieldError>{err.currentPassword}</FieldError>
      </div>

      <div>
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-invalid={!!err.newPassword}
        />
        <FieldError>{err.newPassword}</FieldError>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-invalid={!!err.confirmPassword}
        />
        <FieldError>{err.confirmPassword}</FieldError>
      </div>

      <SubmitButton />
    </form>
  )
}
