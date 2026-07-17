-- =============================================================================
-- Migration 2 : Row Level Security
--
-- Corrige trois failles du design d'origine :
--   1. Récursion infinie : les policies de `profiles` interrogeaient `profiles`.
--      Le test de rôle passe désormais par des fonctions SECURITY DEFINER, qui
--      ne déclenchent pas les policies de la table qu'elles lisent.
--   2. Escalade de privilèges : la policy UPDATE de `profiles` ne restreignait
--      aucune colonne, donc `update profiles set role='Super_Admin'` passait.
--      `role` est maintenant verrouillé par un trigger (migration 3).
--   3. Isolation des tirages : la policy INSERT de `drawings` ne vérifiait pas
--      que la saison visée appartenait bien au groupe du membre.
-- =============================================================================

-- Fonctions d'aide -----------------------------------------------------------
-- SECURITY DEFINER + search_path figé. `stable` permet au planner de ne les
-- évaluer qu'une fois par requête plutôt qu'une fois par ligne.

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(public.current_user_role() = 'Super_Admin', false);
$$;

-- L'utilisateur courant administre-t-il ce groupe ?
create or replace function public.owns_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.tontine_groups
        where id = p_group_id and admin_id = auth.uid()
    ) or public.is_super_admin();
$$;

-- L'utilisateur courant est-il membre (avec compte rattaché) de ce groupe ?
create or replace function public.belongs_to_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.members
        where group_id = p_group_id
          and user_id = auth.uid()
          and status = 'active'
    );
$$;

-- La fiche membre appartient-elle à l'utilisateur courant ?
create or replace function public.owns_member_record(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.members
        where id = p_member_id and user_id = auth.uid()
    );
$$;

-- Groupe d'une saison (évite de répéter la jointure dans chaque policy).
create or replace function public.season_group_id(p_season_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select group_id from public.seasons where id = p_season_id;
$$;

-- Activation -----------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tontine_groups enable row level security;
alter table public.members enable row level security;
alter table public.seasons enable row level security;
alter table public.drawings enable row level security;
alter table public.beneficiary_orders enable row level security;
alter table public.audit_logs enable row level security;

-- profiles -------------------------------------------------------------------

create policy "profiles_select_own"
    on public.profiles for select
    using (id = auth.uid() or public.is_super_admin());

-- Un admin doit pouvoir afficher le profil rattaché à ses membres.
create policy "profiles_select_linked_members"
    on public.profiles for select
    using (
        exists (
            select 1
            from public.members m
            join public.tontine_groups g on g.id = m.group_id
            where m.user_id = profiles.id
              and g.admin_id = auth.uid()
        )
    );

-- Le changement de `role` est bloqué par enforce_profile_role_immutable().
create policy "profiles_update_own"
    on public.profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

-- Pas de policy INSERT : les profils naissent du trigger on_auth_user_created.
-- Pas de policy DELETE : la suppression suit auth.users en cascade.

-- tontine_groups -------------------------------------------------------------

create policy "groups_select_admin"
    on public.tontine_groups for select
    using (admin_id = auth.uid() or public.is_super_admin());

create policy "groups_select_member"
    on public.tontine_groups for select
    using (public.belongs_to_group(id));

create policy "groups_insert_admin"
    on public.tontine_groups for insert
    with check (
        admin_id = auth.uid()
        and public.current_user_role() in ('Admin', 'Super_Admin')
    );

create policy "groups_update_admin"
    on public.tontine_groups for update
    using (admin_id = auth.uid())
    with check (admin_id = auth.uid());

create policy "groups_delete_admin"
    on public.tontine_groups for delete
    using (admin_id = auth.uid());

-- members --------------------------------------------------------------------

create policy "members_select_admin"
    on public.members for select
    using (public.owns_group(group_id));

create policy "members_select_self"
    on public.members for select
    using (user_id = auth.uid());

-- Un membre voit ses pairs (nécessaire pour afficher l'ordre de passage).
create policy "members_select_peers"
    on public.members for select
    using (public.belongs_to_group(group_id));

create policy "members_insert_admin"
    on public.members for insert
    with check (public.owns_group(group_id));

create policy "members_update_admin"
    on public.members for update
    using (public.owns_group(group_id))
    with check (public.owns_group(group_id));

create policy "members_delete_admin"
    on public.members for delete
    using (public.owns_group(group_id));

-- seasons --------------------------------------------------------------------

create policy "seasons_select_admin"
    on public.seasons for select
    using (public.owns_group(group_id));

create policy "seasons_select_member"
    on public.seasons for select
    using (public.belongs_to_group(group_id));

create policy "seasons_insert_admin"
    on public.seasons for insert
    with check (public.owns_group(group_id));

-- Exigence 5.5 : modification possible avant démarrage seulement. Le passage
-- draft -> drawing/active est réservé aux fonctions de génération (migration 3).
create policy "seasons_update_admin_draft"
    on public.seasons for update
    using (public.owns_group(group_id) and status = 'draft')
    with check (public.owns_group(group_id));

create policy "seasons_delete_admin_draft"
    on public.seasons for delete
    using (public.owns_group(group_id) and status = 'draft');

-- drawings -------------------------------------------------------------------
-- Aucune policy UPDATE/DELETE : exigence 6.5 (un tirage est définitif).
-- Aucune policy INSERT : les tirages passent obligatoirement par la fonction
-- perform_individual_drawing(), qui vérifie l'appelant. Écrire directement dans
-- la table est impossible, ce qui ferme la faille du design d'origine.

create policy "drawings_select_admin"
    on public.drawings for select
    using (public.owns_group(public.season_group_id(season_id)));

create policy "drawings_select_member"
    on public.drawings for select
    using (public.belongs_to_group(public.season_group_id(season_id)));

-- beneficiary_orders ---------------------------------------------------------
-- En écriture, tout passe par les fonctions de génération (migration 3).

create policy "beneficiary_orders_select_admin"
    on public.beneficiary_orders for select
    using (public.owns_group(public.season_group_id(season_id)));

create policy "beneficiary_orders_select_member"
    on public.beneficiary_orders for select
    using (public.belongs_to_group(public.season_group_id(season_id)));

-- audit_logs -----------------------------------------------------------------
-- Ni INSERT (réservé aux triggers SECURITY DEFINER, qui ignorent RLS), ni
-- UPDATE, ni DELETE : la table est en lecture seule pour tous les clients.
-- Le design exposait `with check (true)` en INSERT, ce qui permettait de forger
-- des entrées d'audit.

create policy "audit_logs_select_own"
    on public.audit_logs for select
    using (user_id = auth.uid() or public.is_super_admin());
