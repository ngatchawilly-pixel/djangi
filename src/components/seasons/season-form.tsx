'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import type { ActionState } from '@/actions/seasons.actions'
import { Alert, Button, FieldError, Input, Label } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Création…' : 'Créer la saison'}
    </Button>
  )
}

export function SeasonForm({
  action,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  cancelHref: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const err = state.fieldErrors ?? {}
  const year = new Date().getFullYear()

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <Label htmlFor="name">Nom de la saison *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={`Saison ${year}`}
            aria-invalid={!!err.name}
          />
          <FieldError>{err.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="year">Année *</Label>
          <Input
            id="year"
            name="year"
            type="number"
            min={2020}
            max={2100}
            required
            defaultValue={year}
            aria-invalid={!!err.year}
          />
          <FieldError>{err.year}</FieldError>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startDate">Date de début *</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            aria-invalid={!!err.startDate}
          />
          <FieldError>{err.startDate}</FieldError>
        </div>
        <div>
          <Label htmlFor="endDate">Date de fin *</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            required
            aria-invalid={!!err.endDate}
          />
          <FieldError>{err.endDate}</FieldError>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton />
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
        >
          Annuler
        </Link>
      </div>
    </form>
  )
}
