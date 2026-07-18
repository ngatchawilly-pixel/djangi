'use client'

import { useState, useTransition } from 'react'
import { Dices, GripVertical, Loader2, RotateCw, Shuffle, Users } from 'lucide-react'
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
  openIndividualDrawing,
} from '@/actions/seasons.actions'
import { Alert, Button, Card } from '@/components/ui'
import type { GenerationMode } from '@/lib/validators'

type Member = { id: string; name: string }

const MODES: {
  value: GenerationMode
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
      {/* Le listener clavier de dnd-kit rend le tri accessible (exigence 20.2). */}
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
  membersWithoutAccount,
}: {
  groupId: string
  seasonId: string
  members: Member[]
  hasPreviousSeason: boolean
  membersWithoutAccount: number
}) {
  const [mode, setMode] = useState<GenerationMode | null>(null)
  const [ordered, setOrdered] = useState<Member[]>(members)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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

  function run() {
    setError(undefined)
    startTransition(async () => {
      let result
      switch (mode) {
        case 'automatic_shuffle':
          result = await generateAutomaticShuffle(groupId, seasonId)
          break
        case 'manual':
          result = await generateManualOrder(
            groupId,
            seasonId,
            ordered.map((m) => m.id),
          )
          break
        case 'intelligent_rotation':
          result = await generateIntelligentRotation(groupId, seasonId)
          break
        case 'individual_drawing':
          result = await openIndividualDrawing(groupId, seasonId)
          break
        default:
          return
      }
      if (result?.error) setError(result.error)
    })
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Ordre de passage</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez comment déterminer qui reçoit les fonds, et dans quel ordre.
          Une fois finalisé, l’ordre est verrouillé.
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
          {membersWithoutAccount > 0 ? (
            <Alert>
              <strong>
                {membersWithoutAccount} membre(s) sur {members.length} n’ont pas de
                compte rattaché
              </strong>{' '}
              et ne pourront pas tirer. L’ordre ne se finalisera jamais tant qu’il en
              manque un seul. Faites-les d’abord s’inscrire avec l’email exact de leur
              fiche, ou choisissez un autre mode.
            </Alert>
          ) : (
            <Alert tone="success">
              Les {members.length} membres ont un compte rattaché. Après ouverture, un
              lien de tirage à partager s’affichera ici. L’ordre se finalisera tout
              seul dès que le dernier aura tiré.
            </Alert>
          )}
        </>
      )}

      <Button
        onClick={run}
        disabled={
          !mode ||
          pending ||
          (mode === 'individual_drawing' && membersWithoutAccount > 0)
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {mode === 'individual_drawing' ? 'Ouvrir le tirage' : 'Générer l’ordre'}
      </Button>
    </section>
  )
}
