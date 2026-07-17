import { createGroup } from '@/actions/groups.actions'
import { requireAdmin } from '@/lib/auth/dal'
import { GroupForm } from '@/components/groups/group-form'
import { Card } from '@/components/ui'

export default async function NewGroupPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau groupe</h1>
        <p className="text-sm text-muted-foreground">
          Définissez les règles de cotisation de votre tontine.
        </p>
      </div>

      <Card>
        <GroupForm
          action={createGroup}
          submitLabel="Créer le groupe"
          cancelHref="/groups"
        />
      </Card>
    </div>
  )
}
