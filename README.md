# Tontine Platform — v1

Gestion de groupes de cotisation (tontines). Next.js 16 + Supabase.

Périmètre de cette v1 : **authentification**, **création de groupes**, **ajout de
membres**, **génération de l'ordre de passage** (4 modes). Les réunions, les
paiements, les sanctions, les présences et les exports décrits dans
`requirements.md` ne sont pas implémentés.

## Mise en route

### 1. Créer le projet Supabase

Sur [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
Utilisez un projet **dédié** : les migrations créent des types, des tables et un
trigger sur `auth.users`, qui entreraient en collision avec un projet existant.

### 2. Renseigner les clés

```bash
cp .env.local.example .env.local
```

Puis remplissez avec **Settings → API** :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé `anon` `public` |

N'ajoutez jamais la clé `service_role` : elle contourne RLS.

> Le fichier `.env.local` présent contient des valeurs bidons qui ont servi à
> valider le build. Remplacez-les, sinon l'application échouera à la connexion.

### 3. Appliquer les migrations

Dans le **SQL Editor** du dashboard, exécutez dans l'ordre :

1. `supabase/migrations/20240101000000_initial_schema.sql`
2. `supabase/migrations/20240101000001_rls_policies.sql`
3. `supabase/migrations/20240101000002_functions.sql`

### 4. Activer Realtime sur `drawings`

**Database → Replication → `supabase_realtime`** → cochez la table `drawings`.
Sans ça, le suivi du tirage en direct côté admin ne se met pas à jour tout seul
(le reste fonctionne).

### 5. Lancer

```bash
npm run dev
```

Créez un compte sur `/register` en choisissant **Administrateur**.

## Comment les membres se connectent

Il n'y a pas de flux d'invitation par jeton en v1. Le rattachement se fait par
email :

1. l'admin ajoute un membre **avec son email** ;
2. le membre s'inscrit sur `/register` avec **exactement cette adresse**, en type
   « Membre » ;
3. le trigger `handle_new_user()` rattache automatiquement la fiche au compte.

Une icône de lien apparaît alors à côté du membre dans la liste. Seuls les membres
rattachés peuvent tirer leur numéro.

**Limite assumée** : quiconque contrôle l'adresse email récupère la fiche. C'est
acceptable ici parce que l'admin saisit lui-même les emails, mais un vrai flux
d'invitation (jeton à usage unique, expirable) est à prévoir avant une mise en
production ouverte.

## Les quatre modes d'ordre de passage

Tous s'exécutent dans PostgreSQL, jamais côté client : l'écriture dans
`beneficiary_orders` n'a aucune policy `INSERT`, donc un ordre ne peut pas être
forgé depuis le navigateur.

| Mode | Fonction SQL | Comportement |
|---|---|---|
| Mélange automatique | `generate_automatic_shuffle` | Fisher-Yates, aléa cryptographique |
| Manuel | `generate_manual_order` | Drag & drop, refuse doublons et oublis |
| Tirage individuel | `open_individual_drawing` puis `perform_individual_drawing` | Chaque membre tire ; finalisation automatique au dernier tirage |
| Rotation intelligente | `generate_intelligent_rotation` | Le dernier passe premier ; partants exclus, nouveaux en fin |

Une fois généré, l'ordre est verrouillé (`status = 'active'`, `finalized_at`
renseigné) et les policies interdisent toute modification.

## Écarts par rapport à `design.md`

Le design a été écrit pour Next.js 15 / Tailwind 3.4 / Zod 3. Le scaffolding
installe Next.js 16, Tailwind 4 et Zod 4, ce qui impose :

- **`middleware.ts` → `proxy.ts`** (renommage Next 16, runtime Node only) ;
- **`cookies()`, `params`, `searchParams` sont async** — l'accès synchrone est
  supprimé, plus seulement déprécié ;
- **pas de `tailwind.config.ts`** : les tokens vivent dans `globals.css` via
  `@theme` ;
- **pas de shadcn/ui** : kit maison dans `src/components/ui.tsx`, le CLI shadcn
  n'étant pas stabilisé sur Tailwind 4 + Next 16.

Écarts de modèle de données, motivés par des bugs du design (détaillés en
commentaire dans les migrations) :

- `seasons.beneficiary_order JSONB` supprimé — doublon jamais alimenté ;
- `number_of_meetings` → `expected_member_count` — le design confondait nombre de
  réunions et nombre de membres, ce qui bloquait la finalisation dès qu'un membre
  changeait de statut.

Failles du design corrigées : escalade de privilèges via `UPDATE profiles`,
récursion infinie des policies sur `profiles`, fonctions `SECURITY DEFINER`
acceptant un `member_id`/`admin_id` arbitraire, `audit_logs` avec
`INSERT WITH CHECK (true)`, overflow entier et biais modulo dans le générateur
aléatoire, `INTERSECT` détruisant l'ordre de la rotation.

## Vérification

- `npx tsc --noEmit` : passe
- `npm run build` : passe

**Les migrations SQL n'ont jamais été exécutées** — aucun projet Supabase n'était
disponible au moment de l'écriture. Attendez-vous à devoir corriger des détails de
syntaxe au premier passage dans le SQL Editor.

## Reste à faire

- Exécuter les migrations et tester le parcours de bout en bout
- Tests (Vitest + Playwright) : aucun n'existe, et `design.md` n'a pas de section
  de stratégie de test
- Réunions, paiements, sanctions, présences, exports (exigences 10 à 17)
- Flux d'invitation par jeton
- Mode sombre : les tokens existent, le sélecteur n'est pas branché
