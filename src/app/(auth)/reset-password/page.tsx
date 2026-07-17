'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { updatePassword, type ActionState } from '@/actions/auth.actions'
import { Alert, Button, Input, Label } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Mise à jour…' : 'Définir le mot de passe'}
    </Button>
  )
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updatePassword,
    {},
  )

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Choisissez un mot de passe d’au moins 8 caractères.
      </p>

      <form action={formAction} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}

        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <SubmitButton />
      </form>
    </div>
  )
}
