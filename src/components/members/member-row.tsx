'use client'

import { useTransition } from 'react'
import { Link2, Trash2 } from 'lucide-react'

import { removeMember, updateMemberStatus } from '@/actions/members.actions'
import { Badge } from '@/components/ui'

type Member = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  status: string
  user_id: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  excluded: 'Exclu',
  left: 'Parti',
}

export function MemberRow({ member, groupId }: { member: Member; groupId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {member.first_name} {member.last_name}
          {member.user_id && (
            <span
              title="Compte rattaché — ce membre peut se connecter et tirer son numéro"
              className="text-primary-500"
            >
              <Link2 className="size-3.5" />
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {member.email ?? 'Sans email'}
          {member.phone ? ` · ${member.phone}` : ''}
        </p>
      </div>

      <Badge tone={member.status === 'active' ? 'success' : 'neutral'}>
        {STATUS_LABEL[member.status] ?? member.status}
      </Badge>

      <select
        aria-label={`Statut de ${member.first_name} ${member.last_name}`}
        value={member.status}
        disabled={pending}
        onChange={(e) =>
          startTransition(() =>
            updateMemberStatus(
              member.id,
              groupId,
              e.target.value as 'active' | 'suspended' | 'excluded' | 'left',
            ),
          )
        }
        className="min-h-9 rounded-lg border border-border bg-card px-2 text-sm"
      >
        <option value="active">Actif</option>
        <option value="suspended">Suspendu</option>
        <option value="excluded">Exclu</option>
        <option value="left">Parti</option>
      </select>

      <button
        type="button"
        aria-label={`Retirer ${member.first_name} ${member.last_name}`}
        disabled={pending}
        onClick={() => {
          if (
            confirm(
              `Retirer ${member.first_name} ${member.last_name} du groupe ? Cette action est définitive.`,
            )
          ) {
            startTransition(() => removeMember(member.id, groupId))
          }
        }}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-error-600 disabled:opacity-50"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}
