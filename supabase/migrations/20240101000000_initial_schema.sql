-- =============================================================================
-- Migration 1 : schéma initial (périmètre v1)
--
-- Périmètre : authentification, groupes, membres, saisons, ordre de passage.
-- Hors périmètre v1 : réunions, paiements, sanctions, présences, exports.
--
-- Écarts assumés vs design.md (voir README) :
--   * `seasons.beneficiary_order JSONB` supprimé : la table `beneficiary_orders`
--     est l'unique source de vérité. Le design stockait les deux et n'alimentait
--     jamais le JSONB.
--   * `seasons.number_of_meetings` remplacé par `expected_member_count`, calculé
--     et figé à la finalisation. Le design confondait « nombre de réunions » et
--     « nombre de membres », ce qui rendait la finalisation impossible dès qu'un
--     membre était ajouté ou suspendu après la création de la saison.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Types énumérés -------------------------------------------------------------

create type user_role as enum ('Super_Admin', 'Admin', 'Member');
create type group_status as enum ('active', 'inactive', 'archived');
create type member_status as enum ('active', 'suspended', 'excluded', 'left');
create type season_status as enum ('draft', 'drawing', 'active', 'completed', 'cancelled');
create type contribution_frequency as enum ('weekly', 'biweekly', 'monthly', 'quarterly', 'custom');
create type gender_type as enum ('male', 'female', 'other', 'prefer_not_to_say');
create type order_generation_mode as enum ('individual_drawing', 'automatic_shuffle', 'manual', 'intelligent_rotation');
create type audit_action as enum ('create', 'update', 'delete', 'drawing', 'finalize_order');

-- profiles -------------------------------------------------------------------
-- Étend auth.users. `role` n'est PAS modifiable par son propriétaire : voir la
-- migration 2 (le design d'origine permettait à tout utilisateur de se promouvoir
-- Super_Admin via un simple UPDATE sur sa propre ligne).

create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    email       text unique not null,
    first_name  text,
    last_name   text,
    phone       text,
    avatar_url  text,
    role        user_role not null default 'Member',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- tontine_groups -------------------------------------------------------------

create table public.tontine_groups (
    id                  uuid primary key default gen_random_uuid(),
    admin_id            uuid not null references public.profiles (id) on delete cascade,
    name                text not null,
    description         text,
    contribution_amount numeric(15, 2) not null check (contribution_amount > 0),
    frequency           contribution_frequency not null default 'monthly',
    currency            text not null default 'XAF',
    location            text,
    meeting_time        time,
    status              group_status not null default 'active',
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    constraint unique_group_name_per_admin unique (admin_id, name),
    constraint check_group_name_not_blank check (length(btrim(name)) > 0)
);

-- members --------------------------------------------------------------------
-- `user_id` est nullable : un membre existe comme fiche gérée par l'admin avant
-- d'avoir un compte. Le rattachement se fait par email à l'inscription (v1) —
-- voir link_member_accounts() en migration 3.

create table public.members (
    id          uuid primary key default gen_random_uuid(),
    group_id    uuid not null references public.tontine_groups (id) on delete cascade,
    user_id     uuid references public.profiles (id) on delete set null,
    first_name  text not null,
    last_name   text not null,
    phone       text,
    email       text,
    gender      gender_type,
    birth_date  date,
    profession  text,
    photo_url   text,
    entry_date  date not null default current_date,
    status      member_status not null default 'active',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    -- CHECK passe sur NULL (résultat NULL = accepté) : email reste optionnel.
    constraint check_member_email_format
        check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    -- Exigence 4.7 : le design ne validait que l'email. E.164, tolère espaces.
    constraint check_member_phone_format
        check (phone ~ '^\+?[0-9][0-9 .-]{6,19}$'),
    constraint unique_member_email_per_group unique (group_id, email)
);

-- seasons --------------------------------------------------------------------

create table public.seasons (
    id                     uuid primary key default gen_random_uuid(),
    group_id               uuid not null references public.tontine_groups (id) on delete cascade,
    name                   text not null,
    year                   int not null,
    start_date             date not null,
    end_date               date not null,
    -- Nombre de membres actifs figé à l'ouverture du tirage / à la finalisation.
    -- NULL tant que la saison est en brouillon.
    expected_member_count  int check (expected_member_count > 0),
    generation_mode        order_generation_mode,
    status                 season_status not null default 'draft',
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),
    finalized_at           timestamptz,

    constraint check_season_dates check (end_date > start_date),
    constraint check_season_year check (year between 2020 and 2100),
    constraint unique_season_name_per_group unique (group_id, name),
    -- Une saison finalisée a forcément un mode et un effectif.
    constraint check_finalized_consistency check (
        status not in ('active', 'completed')
        or (generation_mode is not null and expected_member_count is not null and finalized_at is not null)
    )
);

-- Une seule saison non terminée par groupe : évite deux ordres concurrents.
create unique index unique_open_season_per_group
    on public.seasons (group_id)
    where status in ('draft', 'drawing', 'active');

-- drawings -------------------------------------------------------------------
-- Un tirage = un membre s'attribue un numéro (mode individual_drawing).

create table public.drawings (
    id           uuid primary key default gen_random_uuid(),
    season_id    uuid not null references public.seasons (id) on delete cascade,
    member_id    uuid not null references public.members (id) on delete cascade,
    drawn_number int not null check (drawn_number > 0),
    drawn_at     timestamptz not null default now(),

    constraint unique_drawing_per_member_season unique (season_id, member_id),
    constraint unique_number_per_season unique (season_id, drawn_number)
);

-- beneficiary_orders ---------------------------------------------------------
-- Source de vérité unique de l'ordre de passage.

create table public.beneficiary_orders (
    id         uuid primary key default gen_random_uuid(),
    season_id  uuid not null references public.seasons (id) on delete cascade,
    member_id  uuid not null references public.members (id) on delete cascade,
    position   int not null check (position > 0),
    created_at timestamptz not null default now(),

    constraint unique_position_per_season unique (season_id, position)
        deferrable initially deferred,
    constraint unique_member_per_season unique (season_id, member_id)
);

-- audit_logs -----------------------------------------------------------------
-- Immuable : aucune policy UPDATE/DELETE n'est créée (migration 2), et RLS
-- refuse par défaut ce qui n'est pas explicitement autorisé.

create table public.audit_logs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references public.profiles (id) on delete set null,
    action_type audit_action not null,
    entity_type text not null,
    entity_id   uuid,
    old_data    jsonb,
    new_data    jsonb,
    created_at  timestamptz not null default now()
);

-- Index ----------------------------------------------------------------------

create index idx_tontine_groups_admin_id on public.tontine_groups (admin_id);
create index idx_members_group_id on public.members (group_id);
create index idx_members_user_id on public.members (user_id);
create index idx_members_group_status on public.members (group_id, status);
create index idx_members_email_lower on public.members (lower(email));
create index idx_seasons_group_id on public.seasons (group_id);
create index idx_seasons_group_status on public.seasons (group_id, status);
create index idx_drawings_season_id on public.drawings (season_id);
create index idx_beneficiary_orders_season_position on public.beneficiary_orders (season_id, position);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_logs_created_at on public.audit_logs (created_at desc);
