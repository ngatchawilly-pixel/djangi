'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { requestPasswordReset, type ActionState } from '@/actions/auth.actions'
import { Alert, Button, Input, Label } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Envoi…' : 'Envoyer le lien'}
    </Button>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    requestPasswordReset,
    {},
  )

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Nous vous enverrons un lien de réinitialisation.
      </p>

      <form action={formAction} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
