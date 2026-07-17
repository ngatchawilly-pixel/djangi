'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { register, type ActionState } from '@/actions/auth.actions'
import { Alert, Button, Input, Label, Select } from '@/components/ui'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Création…' : 'Créer mon compte'}
    </Button>
  )
}

export default function RegisterPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(register, {})

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Créer un compte</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Quelques secondes suffisent.
      </p>

      <form action={formAction} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Prénom</Label>
            <Input id="firstName" name="firstName" required autoComplete="given-name" />
          </div>
          <div>
            <Label htmlFor="lastName">Nom</Label>
            <Input id="lastName" name="lastName" required autoComplete="family-name" />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div>
          <Label htmlFor="role">Type de compte</Label>
          <Select id="role" name="role" defaultValue="Admin">
            <option value="Admin">Administrateur — je gère mes tontines</option>
            <option value="Member">Membre — je participe à une tontine</option>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Choisissez « Membre » si un administrateur vous a déjà inscrit : votre
            fiche sera rattachée automatiquement à cette adresse email.
          </p>
        </div>

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

        <div>
          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-foreground">
        Déjà inscrit ?{' '}
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
