'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, UserPlus } from 'lucide-react'

import { addMember, type ActionState } from '@/actions/members.actions'
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Select,
} from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <UserPlus className="size-4" />
      )}
      {pending ? 'Ajout…' : 'Ajouter le membre'}
    </Button>
  )
}

export function MemberForm({ groupId }: { groupId: string }) {
  const action = addMember.bind(null, groupId)
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const formRef = useRef<HTMLFormElement>(null)

  // Vide le formulaire après un ajout réussi, pour enchaîner les saisies.
  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  const err = state.fieldErrors ?? {}

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">Prénom *</Label>
          <Input id="firstName" name="firstName" required aria-invalid={!!err.firstName} />
          <FieldError>{err.firstName}</FieldError>
        </div>
        <div>
          <Label htmlFor="lastName">Nom *</Label>
          <Input id="lastName" name="lastName" required aria-invalid={!!err.lastName} />
          <FieldError>{err.lastName}</FieldError>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" aria-invalid={!!err.email} />
          <FieldError>{err.email}</FieldError>
          <p className="mt-1 text-xs text-muted-foreground">
            Nécessaire si le membre doit tirer son propre numéro.
          </p>
        </div>
        <div>
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+237 6 12 34 56 78"
            aria-invalid={!!err.phone}
          />
          <FieldError>{err.phone}</FieldError>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="gender">Genre</Label>
          <Select id="gender" name="gender" defaultValue="">
            <option value="">Non précisé</option>
            <option value="female">Féminin</option>
            <option value="male">Masculin</option>
            <option value="other">Autre</option>
            <option value="prefer_not_to_say">Ne souhaite pas préciser</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="birthDate">Date de naissance</Label>
          <Input id="birthDate" name="birthDate" type="date" />
        </div>
        <div>
          <Label htmlFor="entryDate">Date d’entrée</Label>
          <Input
            id="entryDate"
            name="entryDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="profession">Profession</Label>
        <Input id="profession" name="profession" />
      </div>

      <SubmitButton />
    </form>
  )
}
