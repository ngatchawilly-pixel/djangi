'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { updateProfile, type ActionState } from '@/actions/profile.actions'
import { Alert, Button, FieldError, Input, Label } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  )
}

export function ProfileForm({
  defaults,
}: {
  defaults: { firstName: string; lastName: string; phone: string; email: string }
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateProfile, {})
  const err = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            name="firstName"
            required
            defaultValue={defaults.firstName}
            autoComplete="given-name"
            aria-invalid={!!err.firstName}
          />
          <FieldError>{err.firstName}</FieldError>
        </div>
        <div>
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            name="lastName"
            required
            defaultValue={defaults.lastName}
            autoComplete="family-name"
            aria-invalid={!!err.lastName}
          />
          <FieldError>{err.lastName}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="phone">Téléphone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaults.phone}
          placeholder="+237 6 12 34 56 78"
          autoComplete="tel"
          aria-invalid={!!err.phone}
        />
        <FieldError>{err.phone}</FieldError>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={defaults.email} disabled readOnly />
        <p className="mt-1 text-xs text-muted-foreground">
          L’adresse email n’est pas modifiable ici.
        </p>
      </div>

      <SubmitButton />
    </form>
  )
}
