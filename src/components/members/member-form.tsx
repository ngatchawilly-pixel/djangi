'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react'

import {
  addMember,
  lookupUserByEmail,
  type ActionState,
} from '@/actions/members.actions'
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

type LookupState =
  | { status: 'idle' }
  | { status: 'found'; name: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export function MemberForm({ groupId }: { groupId: string }) {
  const action = addMember.bind(null, groupId)
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const formRef = useRef<HTMLFormElement>(null)

  // Contrôlés pour que la recherche puisse les pré-remplir.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const [searching, startSearch] = useTransition()

  // Réinitialise tout après un ajout réussi, pour enchaîner les saisies.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setFirstName('')
      setLastName('')
      setEmail('')
      setLookup({ status: 'idle' })
    }
  }, [state.success])

  function search() {
    setLookup({ status: 'idle' })
    startSearch(async () => {
      const result = await lookupUserByEmail(email)
      if (result.error) {
        setLookup({ status: 'error', message: result.error })
        return
      }
      if (!result.found) {
        setLookup({ status: 'not_found' })
        return
      }
      // Pré-remplit les noms uniquement si l'admin ne les a pas déjà saisis.
      if (result.firstName && !firstName) setFirstName(result.firstName)
      if (result.lastName && !lastName) setLastName(result.lastName)
      setLookup({
        status: 'found',
        name: `${result.firstName ?? ''} ${result.lastName ?? ''}`.trim(),
      })
    })
  }

  const err = state.fieldErrors ?? {}

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      {/* Recherche par email exact ------------------------------------- */}
      <div>
        <Label htmlFor="email">Email</Label>
        <div className="flex gap-2">
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setLookup({ status: 'idle' })
            }}
            aria-invalid={!!err.email}
            placeholder="membre@exemple.com"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={search}
            disabled={searching || !email.trim()}
            className="shrink-0"
          >
            {searching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Rechercher
          </Button>
        </div>
        <FieldError>{err.email}</FieldError>

        {lookup.status === 'found' && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-success-600">
            <Check className="size-4" /> Compte trouvé : {lookup.name}. Le membre sera
            rattaché et pourra tirer son numéro.
          </p>
        )}
        {lookup.status === 'not_found' && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <X className="size-4" /> Aucun compte pour cet email. La fiche sera reliée
            automatiquement dès que la personne s’inscrira avec cette adresse.
          </p>
        )}
        {lookup.status === 'error' && (
          <p className="mt-1.5 text-sm text-error-600">{lookup.message}</p>
        )}
      </div>

      {/* Identité ------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">Prénom *</Label>
          <Input
            id="firstName"
            name="firstName"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            aria-invalid={!!err.firstName}
          />
          <FieldError>{err.firstName}</FieldError>
        </div>
        <div>
          <Label htmlFor="lastName">Nom *</Label>
          <Input
            id="lastName"
            name="lastName"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            aria-invalid={!!err.lastName}
          />
          <FieldError>{err.lastName}</FieldError>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <div>
          <Label htmlFor="profession">Profession</Label>
          <Input id="profession" name="profession" />
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

      <SubmitButton />
    </form>
  )
}
