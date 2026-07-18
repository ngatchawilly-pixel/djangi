import { requireProfile } from '@/lib/auth/dal'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { Card } from '@/components/ui'

export default async function SettingsPage() {
  const profile = await requireProfile()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Connecté en tant que {profile.email}.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mot de passe</h2>
        <Card>
          <ChangePasswordForm />
        </Card>
      </section>
    </div>
  )
}
