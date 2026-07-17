'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import type { ActionState } from '@/actions/groups.actions'
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui'

export type GroupDefaults = {
  name?: string
  description?: string | null
  contribution_amount?: number
  frequency?: string
  currency?: string
  location?: string | null
  meeting_time?: string | null
}

const FREQUENCIES = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'biweekly', label: 'Toutes les deux semaines' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
  { value: 'custom', label: 'Personnalisée' },
]

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Enregistrement…' : label}
    </Button>
  )
}

export function GroupForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  defaults?: GroupDefaults
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const err = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}

      <div>
        <Label htmlFor="name">Nom du groupe *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults?.name}
          aria-invalid={!!err.name}
          placeholder="Tontine des amis"
        />
        <FieldError>{err.name}</FieldError>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ''}
        />
        <FieldError>{err.description}</FieldError>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contributionAmount">Montant de la cotisation *</Label>
          <Input
            id="contributionAmount"
            name="contributionAmount"
            type="number"
            min="1"
            step="any"
            required
            defaultValue={defaults?.contribution_amount}
            aria-invalid={!!err.contributionAmount}
          />
          <FieldError>{err.contributionAmount}</FieldError>
        </div>

        <div>
          <Label htmlFor="currency">Devise</Label>
          <Select
            id="currency"
            name="currency"
            defaultValue={defaults?.currency ?? 'XAF'}
          >
            <option value="XAF">XAF — Franc CFA</option>
            <option value="XOF">XOF — Franc CFA (UEMOA)</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="frequency">Fréquence *</Label>
          <Select
            id="frequency"
            name="frequency"
            defaultValue={defaults?.frequency ?? 'monthly'}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="meetingTime">Heure de réunion</Label>
          <Input
            id="meetingTime"
            name="meetingTime"
            type="time"
            defaultValue={defaults?.meeting_time ?? ''}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="location">Lieu</Label>
        <Input
          id="location"
          name="location"
          defaultValue={defaults?.location ?? ''}
          placeholder="Douala, Akwa"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton label={submitLabel} />
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
