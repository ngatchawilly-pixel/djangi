import { requireProfile } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { ProfileForm } from '@/components/settings/profile-form'
import { Card } from '@/components/ui'

export default async function SettingsPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('id', profile.id)
    .single()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Connecté en tant que {profile.email}.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Profil</h2>
        <Card>
          <ProfileForm
            defaults={{
              firstName: row?.first_name ?? '',
              lastName: row?.last_name ?? '',
              phone: row?.phone ?? '',
              email: profile.email,
            }}
          />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mot de passe</h2>
        <Card>
          <ChangePasswordForm />
        </Card>
      </section>
    </div>
  )
}
