'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Dices,
  GripVertical,
  Loader2,
  RotateCw,
  Shuffle,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  generateAutomaticShuffle,
  generateIntelligentRotation,
  generateManualOrder,
  generateMixedOrder,
  openIndividualDrawing,
} from '@/actions/seasons.actions'
import { Alert, Button, Card, Input } from '@/components/ui'

type Member = { id: string; name: string; hasAccount: boolean }

// 'mixed' n'existe pas dans l'enum SQL (c'est un mode de fabrication, pas de
// stockage) : on étend le type localement.
type UIMode =
  | 'automatic_shuffle'
  | 'manual'
  | 'individual_drawing'
  | 'intelligent_rotation'
  | 'mixed'

const MODES: {
  value: UIMode
  label: string
  description: string
  icon: typeof Shuffle
}[] = [
  {
    value: 'automatic_shuffle',
    label: 'Mélange automatique',
    description: 'Le système tire un ordre au hasard, immédiatement.',
    icon: Shuffle,
  },
  {
    value: 'manual',
    label: 'Ordre manuel',
    description: 'Vous placez chaque membre vous-même.',
    icon: Users,
  },
  {
    value: 'individual_drawing',
    label: 'Tirage individuel',
    description: 'Chaque membre tire son propre numéro depuis son compte.',
    icon: Dices,
  },
  {
    value: 'mixed',
    label: 'Mixte',
    description:
      'Fixez le numéro de certains membres ; le reste est complété au hasard ou par tirage.',
    icon: SlidersHorizontal,
  },
  {
    value: 'intelligent_rotation',
    label: 'Rotation intelligente',
    description: 'Le dernier de la saison précédente passe premier.',
    icon: RotateCw,
  },
]

function SortableMember({ member, index }: { member: Member; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: member.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 border-b border-border bg-card p-3 last:border-b-0 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-sm font-semibold text-primary-600">
        {index + 1}
      </span>
      <span className="flex-1 font-medium">{member.name}</span>
      <button
        type="button"
        aria-label={`Déplacer ${member.name}`}
        className="cursor-grab touch-none rounded p-2 text-muted-foreground hover:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
    </li>
  )
}

export function OrderGenerator({
  groupId,
  seasonId,
  members,
  hasPreviousSeason,
}: {
  groupId: string
  seasonId: string
  members: Member[]
  hasPreviousSeason: boolean
}) {
  const [mode, setMode] = useState<UIMode | null>(null)
  const [ordered, setOrdered] = useState<Member[]>(members)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  // Mode mixte : complétion + positions épinglées (memberId -> saisie texte).
  const [fill, setFill] = useState<'shuffle' | 'drawing'>('shuffle')
  const [pins, setPins] = useState<Record<string, string>>({})

  const n = members.length
  const noAccountCount = members.filter((m) => !m.hasAccount).length

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Épingles non-pinnées qui devront tirer, sans compte : elles bloqueraient la
  // finalisation d'un tirage mixte.
  const pinnedIds = useMemo(
    () => new Set(Object.entries(pins).filter(([, v]) => v.trim() !== '').map(([id]) => id)),
    [pins],
  )
  const drawersWithoutAccount = useMemo(
    () => members.filter((m) => !m.hasAccount && !pinnedIds.has(m.id)).length,
    [members, pinnedIds],
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrdered((items) => {
      const from = items.findIndex((i) => i.id === active.id)
      const to = items.findIndex((i) => i.id === over.id)
      return arrayMove(items, from, to)
    })
  }

  /** Valide et construit les épingles du mode mixte. Retourne une erreur ou les pins. */
  function buildPins():
    | { error: string }
    | { pins: { member_id: string; position: number }[] } {
    const out: { member_id: string; position: number }[] = []
    const seen = new Set<number>()
    for (const [memberId, raw] of Object.entries(pins)) {
      const v = raw.trim()
      if (v === '') continue
      const pos = Number(v)
      if (!Number.isInteger(pos) || pos < 1 || pos > n) {
        return { error: `Position « ${v} » invalide : attendez un entier entre 1 et ${n}.` }
      }
      if (seen.has(pos)) {
        return { error: `La position ${pos} est attribuée à deux membres.` }
      }
      seen.add(pos)
      out.push({ member_id: memberId, position: pos })
    }
    return { pins: out }
  }

  function run() {
    setError(undefined)
    startTransition(async () => {
      let result
      switch (mode) {
        case 'automatic_shuffle':
          result = await generateAutomaticShuffle(groupId, seasonId)
          break
        case 'manual':
          result = await generateManualOrder(groupId, seasonId, ordered.map((m) => m.id))
          break
        case 'intelligent_rotation':
          result = await generateIntelligentRotation(groupId, seasonId)
          break
        case 'individual_drawing':
          result = await openIndividualDrawing(groupId, seasonId)
          break
        case 'mixed': {
          const built = buildPins()
          if ('error' in built) {
            setError(built.error)
            return
          }
          result = await generateMixedOrder(groupId, seasonId, built.pins, fill)
          break
        }
        default:
          return
      }
      if (result?.error) setError(result.error)
    })
  }

  const submitDisabled =
    !mode ||
    pending ||
    (mode === 'individual_drawing' && noAccountCount > 0) ||
    (mode === 'mixed' && fill === 'drawing' && drawersWithoutAccount > 0)

  const submitLabel =
    (mode === 'individual_drawing' || (mode === 'mixed' && fill === 'drawing'))
      ? 'Ouvrir le tirage'
      : 'Générer l’ordre'

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Ordre de passage</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez comment déterminer qui reçoit les fonds, et dans quel ordre. Une
          fois finalisé, l’ordre est verrouillé.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Mode d’attribution de l’ordre</legend>
        {MODES.map((m) => {
          const disabled = m.value === 'intelligent_rotation' && !hasPreviousSeason
          const Icon = m.icon
          return (
            <label
              key={m.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                mode === m.value
                  ? 'border-primary-500 bg-primary-500/5'
                  : 'border-border hover:border-primary-300'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                disabled={disabled}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-1"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <Icon className="size-4" /> {m.label}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{m.description}</p>
                {disabled && (
                  <p className="mt-1 text-xs text-warning-500">
                    Nécessite une saison précédente terminée.
                  </p>
                )}
              </div>
            </label>
          )
        })}
      </fieldset>

      {mode === 'manual' && (
        <Card className="p-0">
          <p className="border-b border-border p-3 text-sm text-muted-foreground">
            Glissez les membres pour définir l’ordre ({ordered.length} membres).
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ordered.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol>
                {ordered.map((m, i) => (
                  <SortableMember key={m.id} member={m} index={i} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </Card>
      )}

      {mode === 'individual_drawing' && (
        <>
          {noAccountCount > 0 ? (
            <Alert>
              <strong>
                {noAccountCount} membre(s) sur {n} n’ont pas de compte rattaché
              </strong>{' '}
              et ne pourront pas tirer. L’ordre ne se finalisera jamais tant qu’il en
              manque un seul. Faites-les d’abord s’inscrire avec l’email exact de leur
              fiche, ou choisissez un autre mode.
            </Alert>
          ) : (
            <Alert tone="success">
              Les {n} membres ont un compte rattaché. Après ouverture, un lien de tirage
              à partager s’affichera ici. L’ordre se finalisera tout seul dès que le
              dernier aura tiré.
            </Alert>
          )}
        </>
      )}

      {mode === 'mixed' && (
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-medium">Comment compléter le reste ?</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                  fill === 'shuffle' ? 'border-primary-500 bg-primary-500/5' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="fill"
                  checked={fill === 'shuffle'}
                  onChange={() => setFill('shuffle')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Mélange automatique</span>
                  <br />
                  Les non-épinglés sont placés au hasard, tout de suite.
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                  fill === 'drawing' ? 'border-primary-500 bg-primary-500/5' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="fill"
                  checked={fill === 'drawing'}
                  onChange={() => setFill('drawing')}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Tirage individuel</span>
                  <br />
                  Les non-épinglés tirent eux-mêmes parmi les numéros restants.
                </span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Attribuer des numéros</p>
            <p className="text-xs text-muted-foreground">
              Saisissez un numéro (1–{n}) pour qui vous voulez fixer, laissez vide pour
              le reste.
            </p>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-2.5">
                  <span className="flex-1 text-sm">{m.name}</span>
                  {fill === 'drawing' && !m.hasAccount && !pinnedIds.has(m.id) && (
                    <span className="text-xs text-warning-500">sans compte</span>
                  )}
                  <Input
                    type="number"
                    min={1}
                    max={n}
                    inputMode="numeric"
                    aria-label={`Numéro de ${m.name}`}
                    value={pins[m.id] ?? ''}
                    onChange={(e) =>
                      setPins((p) => ({ ...p, [m.id]: e.target.value }))
                    }
                    className="min-h-9 w-20"
                    placeholder="—"
                  />
                </li>
              ))}
            </ul>
          </div>

          {fill === 'drawing' && drawersWithoutAccount > 0 && (
            <Alert>
              {drawersWithoutAccount} membre(s) à tirer n’ont pas de compte rattaché.
              Épinglez-les manuellement, faites-les s’inscrire, ou complétez par mélange.
            </Alert>
          )}
        </Card>
      )}

      <Button onClick={run} disabled={submitDisabled}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </section>
  )
}
