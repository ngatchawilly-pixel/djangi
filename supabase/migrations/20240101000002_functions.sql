-- =============================================================================
-- Migration 3 : fonctions, génération de l'ordre, triggers
--
-- Règle de sécurité appliquée partout : toute fonction SECURITY DEFINER
-- contourne RLS, donc elle DOIT vérifier l'appelant elle-même. Le design
-- d'origine acceptait `p_member_id` / `p_admin_id` en paramètre sans jamais les
-- confronter à auth.uid(), ce qui permettait d'agir au nom d'autrui.
-- =============================================================================

-- Horodatage -----------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
    for each row execute function public.touch_updated_at();
create trigger trg_groups_updated_at before update on public.tontine_groups
    for each row execute function public.touch_updated_at();
create trigger trg_members_updated_at before update on public.members
    for each row execute function public.touch_updated_at();
create trigger trg_seasons_updated_at before update on public.seasons
    for each row execute function public.touch_updated_at();

-- Verrou sur le rôle ---------------------------------------------------------
-- Sans ça, la policy profiles_update_own laisserait n'importe qui se promouvoir.

create or replace function public.enforce_profile_role_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.role is distinct from old.role and not public.is_super_admin() then
        raise exception 'Seul un Super_Admin peut modifier un rôle'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

create trigger trg_profiles_role_immutable before update on public.profiles
    for each row execute function public.enforce_profile_role_immutable();

-- Création de compte ---------------------------------------------------------
-- Le rôle vient des métadonnées d'inscription mais est filtré : 'Super_Admin'
-- n'est jamais attribuable en self-service (il se pose à la main en SQL).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_requested text := new.raw_user_meta_data ->> 'role';
    v_role user_role;
begin
    v_role := case when v_requested = 'Admin' then 'Admin'::user_role
                   else 'Member'::user_role end;

    insert into public.profiles (id, email, first_name, last_name, role)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'first_name',
        new.raw_user_meta_data ->> 'last_name',
        v_role
    );

    -- Rattachement des fiches membres créées par un admin avec cet email.
    -- Simplification v1 : pas de jeton d'invitation. Quiconque contrôle l'email
    -- récupère la fiche. Acceptable ici car l'admin saisit lui-même les emails.
    update public.members
    set user_id = new.id
    where lower(email) = lower(new.email)
      and user_id is null;

    return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();

-- Aléa ------------------------------------------------------------------------
-- Corrige deux bugs du design :
--   * `get_byte(...) << 24` était évalué en INT : dès que l'octet de poids fort
--     dépassait 127, PostgreSQL levait « integer out of range » (~1 appel sur 2).
--     Les casts en BIGINT précèdent maintenant les décalages.
--   * `random % range` introduisait un biais modulo. Rejet des valeurs au-delà
--     du plus grand multiple de `range` pour une distribution uniforme.

create or replace function public.secure_random_int(min_val int, max_val int)
returns int
language plpgsql
volatile
as $$
declare
    v_range bigint := max_val::bigint - min_val::bigint + 1;
    v_limit bigint;
    v_bytes bytea;
    v_rand  bigint;
begin
    if v_range <= 0 then
        raise exception 'Intervalle invalide : [%, %]', min_val, max_val;
    end if;
    if v_range = 1 then
        return min_val;
    end if;

    v_limit := (4294967296::bigint / v_range) * v_range;

    loop
        v_bytes := gen_random_bytes(4);
        v_rand := (get_byte(v_bytes, 0)::bigint << 24)
                | (get_byte(v_bytes, 1)::bigint << 16)
                | (get_byte(v_bytes, 2)::bigint << 8)
                |  get_byte(v_bytes, 3)::bigint;
        exit when v_rand < v_limit;
    end loop;

    return min_val + (v_rand % v_range)::int;
end;
$$;

-- Écriture de l'ordre --------------------------------------------------------
-- Fabrique commune : pose l'ordre, marque la saison finalisée, journalise.
-- `p_member_ids` est ordonné : position = indice dans le tableau.

create or replace function public.write_beneficiary_order(
    p_season_id  uuid,
    p_member_ids uuid[],
    p_mode       order_generation_mode
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    delete from public.beneficiary_orders where season_id = p_season_id;

    insert into public.beneficiary_orders (season_id, member_id, position)
    select p_season_id, member_id, ordinality::int
    from unnest(p_member_ids) with ordinality as t(member_id, ordinality);

    update public.seasons
    set status                = 'active',
        generation_mode       = p_mode,
        expected_member_count = array_length(p_member_ids, 1),
        finalized_at          = now()
    where id = p_season_id;

    insert into public.audit_logs (user_id, action_type, entity_type, entity_id, new_data)
    values (
        auth.uid(), 'finalize_order', 'season', p_season_id,
        jsonb_build_object('mode', p_mode, 'order', to_jsonb(p_member_ids))
    );
end;
$$;

-- Membres actifs d'une saison, ordre stable.
create or replace function public.active_member_ids(p_group_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(array_agg(id order by created_at, id), '{}'::uuid[])
    from public.members
    where group_id = p_group_id and status = 'active';
$$;

-- Garde commune : l'appelant administre-t-il cette saison, et est-elle encore
-- modifiable ?
create or replace function public.assert_season_writable(p_season_id uuid)
returns uuid -- group_id
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    v_group_id uuid;
    v_status   season_status;
begin
    select group_id, status into v_group_id, v_status
    from public.seasons where id = p_season_id;

    if v_group_id is null then
        raise exception 'Saison introuvable' using errcode = 'P0002';
    end if;
    if not public.owns_group(v_group_id) then
        raise exception 'Accès refusé' using errcode = '42501';
    end if;
    if v_status <> 'draft' then
        raise exception 'La saison n''est plus en brouillon (statut : %)', v_status
            using errcode = '55000';
    end if;

    return v_group_id;
end;
$$;

-- Mode 1 : mélange automatique (exigence 7) ----------------------------------

create or replace function public.generate_automatic_shuffle(p_season_id uuid)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group_id uuid;
    v_members  uuid[];
    v_n        int;
    v_j        int;
    v_tmp      uuid;
    i          int;
begin
    v_group_id := public.assert_season_writable(p_season_id);
    v_members  := public.active_member_ids(v_group_id);
    v_n        := coalesce(array_length(v_members, 1), 0);

    if v_n < 2 then
        return query select false, 'Il faut au moins 2 membres actifs'::text;
        return;
    end if;

    -- Fisher-Yates avec aléa cryptographique.
    for i in reverse v_n .. 2 loop
        v_j := public.secure_random_int(1, i);
        v_tmp := v_members[i];
        v_members[i] := v_members[v_j];
        v_members[v_j] := v_tmp;
    end loop;

    perform public.write_beneficiary_order(p_season_id, v_members, 'automatic_shuffle');
    return query select true, format('Ordre généré pour %s membres', v_n)::text;
end;
$$;

-- Mode 2 : ordre manuel (exigence 8) -----------------------------------------

create or replace function public.generate_manual_order(
    p_season_id  uuid,
    p_member_ids uuid[]
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group_id uuid;
    v_expected uuid[];
    v_missing  int;
    v_extra    int;
begin
    v_group_id := public.assert_season_writable(p_season_id);
    v_expected := public.active_member_ids(v_group_id);

    -- Doublons (exigence 8.5)
    if array_length(p_member_ids, 1) is distinct from
       (select count(distinct x) from unnest(p_member_ids) x) then
        return query select false, 'L''ordre contient des doublons'::text;
        return;
    end if;

    -- Membres manquants (exigence 8.4)
    select count(*) into v_missing
    from (select unnest(v_expected) except select unnest(p_member_ids)) s;
    if v_missing > 0 then
        return query select false, format('%s membre(s) manquant(s)', v_missing)::text;
        return;
    end if;

    -- Membres inconnus ou inactifs
    select count(*) into v_extra
    from (select unnest(p_member_ids) except select unnest(v_expected)) s;
    if v_extra > 0 then
        return query select false, format('%s membre(s) non reconnu(s)', v_extra)::text;
        return;
    end if;

    perform public.write_beneficiary_order(p_season_id, p_member_ids, 'manual');
    return query select true, 'Ordre manuel enregistré'::text;
end;
$$;

-- Mode 3 : rotation intelligente (exigence 9) --------------------------------
-- Le design filtrait les partants avec INTERSECT, une opération ensembliste qui
-- ne garantit aucun ordre : la rotation qu'il venait de calculer était perdue.
-- Ici tout passe par une position numérique explicite.

create or replace function public.generate_intelligent_rotation(p_season_id uuid)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group_id uuid;
    v_prev_id  uuid;
    v_prev_n   int;
    v_order    uuid[];
begin
    v_group_id := public.assert_season_writable(p_season_id);

    -- Saison précédente terminée la plus récente (exigence 9.1)
    select id into v_prev_id
    from public.seasons
    where group_id = v_group_id
      and id <> p_season_id
      and status = 'completed'
    order by end_date desc
    limit 1;

    -- Exigence 9.6
    if v_prev_id is null then
        return query select false,
            'Aucune saison précédente terminée : la rotation est impossible'::text;
        return;
    end if;

    select count(*) into v_prev_n
    from public.beneficiary_orders where season_id = v_prev_id;

    if v_prev_n = 0 then
        return query select false, 'La saison précédente n''a pas d''ordre enregistré'::text;
        return;
    end if;

    with prev as (
        select member_id, position
        from public.beneficiary_orders
        where season_id = v_prev_id
    ),
    -- Rotation : le dernier passe premier (exigence 9.3).
    -- position 5/5 -> 1 ; position 1 -> 2 ; etc.
    rotated as (
        select member_id, ((position % v_prev_n) + 1)::numeric as sort_key
        from prev
    ),
    -- Exigence 9.5 : les partants et suspendus sortent de l'ordre.
    kept as (
        select r.member_id, r.sort_key
        from rotated r
        join public.members m on m.id = r.member_id
        where m.group_id = v_group_id and m.status = 'active'
    ),
    -- Exigence 9.4 : les nouveaux arrivent en fin d'ordre.
    newcomers as (
        select m.id as member_id, 1e9::numeric as sort_key
        from public.members m
        where m.group_id = v_group_id
          and m.status = 'active'
          and not exists (select 1 from prev p where p.member_id = m.id)
    )
    select array_agg(member_id order by sort_key, member_id)
    into v_order
    from (select * from kept union all select * from newcomers) s;

    if coalesce(array_length(v_order, 1), 0) < 2 then
        return query select false, 'Il faut au moins 2 membres actifs'::text;
        return;
    end if;

    perform public.write_beneficiary_order(p_season_id, v_order, 'intelligent_rotation');
    return query select true,
        format('Rotation générée pour %s membres', array_length(v_order, 1))::text;
end;
$$;

-- Mode 4 : tirage individuel (exigence 6) ------------------------------------

-- Ouvre le tirage : fige l'effectif et bascule la saison en 'drawing'.
create or replace function public.open_individual_drawing(p_season_id uuid)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group_id uuid;
    v_n        int;
begin
    v_group_id := public.assert_season_writable(p_season_id);
    v_n := coalesce(array_length(public.active_member_ids(v_group_id), 1), 0);

    if v_n < 2 then
        return query select false, 'Il faut au moins 2 membres actifs'::text;
        return;
    end if;

    update public.seasons
    set status = 'drawing',
        generation_mode = 'individual_drawing',
        expected_member_count = v_n
    where id = p_season_id;

    return query select true, format('Tirage ouvert pour %s membres', v_n)::text;
end;
$$;

-- Numéros encore disponibles.
create or replace function public.available_drawing_numbers(p_season_id uuid)
returns table (available_number int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select n
    from generate_series(
        1,
        (select coalesce(expected_member_count, 0) from public.seasons where id = p_season_id)
    ) as n
    where n not in (select drawn_number from public.drawings where season_id = p_season_id)
    order by n;
$$;

-- Tirage d'un membre. Le paramètre p_member_id du design est supprimé : le
-- membre est déduit de auth.uid(), donc on ne peut pas tirer pour autrui.
create or replace function public.perform_individual_drawing(p_season_id uuid)
returns table (drawn_number int, success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group_id  uuid;
    v_member_id uuid;
    v_status    season_status;
    v_numbers   int[];
    v_pick      int;
    v_count     int;
    v_expected  int;
begin
    select group_id, status, expected_member_count
    into v_group_id, v_status, v_expected
    from public.seasons where id = p_season_id;

    if v_group_id is null then
        return query select null::int, false, 'Saison introuvable'::text;
        return;
    end if;

    -- L'appelant a-t-il une fiche membre active dans CE groupe ? (exigence 18.5)
    select id into v_member_id
    from public.members
    where group_id = v_group_id and user_id = auth.uid() and status = 'active';

    if v_member_id is null then
        return query select null::int, false,
            'Vous n''êtes pas membre actif de ce groupe'::text;
        return;
    end if;

    if v_status <> 'drawing' then
        return query select null::int, false,
            'Le tirage n''est pas ouvert pour cette saison'::text;
        return;
    end if;

    -- Exigence 6.4 : un seul tirage par membre.
    if exists (select 1 from public.drawings
               where season_id = p_season_id and member_id = v_member_id) then
        return query select null::int, false, 'Vous avez déjà tiré votre numéro'::text;
        return;
    end if;

    -- Verrou sur la saison : sérialise les tirages concurrents et évite la
    -- course entre lecture des numéros libres et insertion.
    perform 1 from public.seasons where id = p_season_id for update;

    select array(select available_number from public.available_drawing_numbers(p_season_id))
    into v_numbers;

    if coalesce(array_length(v_numbers, 1), 0) = 0 then
        return query select null::int, false, 'Plus aucun numéro disponible'::text;
        return;
    end if;

    v_pick := v_numbers[public.secure_random_int(1, array_length(v_numbers, 1))];

    insert into public.drawings (season_id, member_id, drawn_number)
    values (p_season_id, v_member_id, v_pick);

    -- Exigence 6.8 : dès que tout le monde a tiré, l'ordre se finalise seul.
    select count(*) into v_count from public.drawings where season_id = p_season_id;

    if v_count >= v_expected then
        perform public.write_beneficiary_order(
            p_season_id,
            -- Colonnes qualifiées : `drawn_number` est aussi un paramètre de
            -- sortie de cette fonction, donc non qualifié il est ambigu.
            (select array_agg(d.member_id order by d.drawn_number)
             from public.drawings d where d.season_id = p_season_id),
            'individual_drawing'
        );
    end if;

    return query select v_pick, true, format('Votre numéro est le %s', v_pick)::text;
end;
$$;

-- Avancement du tirage (pour l'admin comme pour les membres).
create or replace function public.drawing_progress(p_season_id uuid)
returns table (total int, completed int, is_complete boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        coalesce(s.expected_member_count, 0),
        (select count(*)::int from public.drawings d where d.season_id = s.id),
        (select count(*) from public.drawings d where d.season_id = s.id)
            >= coalesce(s.expected_member_count, 0)
    from public.seasons s
    where s.id = p_season_id
      and (public.owns_group(s.group_id) or public.belongs_to_group(s.group_id));
$$;

-- Audit ----------------------------------------------------------------------

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_entity text := tg_argv[0];
begin
    if tg_op = 'INSERT' then
        insert into public.audit_logs (user_id, action_type, entity_type, entity_id, new_data)
        values (auth.uid(), 'create', v_entity, new.id, to_jsonb(new));
    elsif tg_op = 'UPDATE' then
        insert into public.audit_logs (user_id, action_type, entity_type, entity_id, old_data, new_data)
        values (auth.uid(), 'update', v_entity, new.id, to_jsonb(old), to_jsonb(new));
    elsif tg_op = 'DELETE' then
        insert into public.audit_logs (user_id, action_type, entity_type, entity_id, old_data)
        values (auth.uid(), 'delete', v_entity, old.id, to_jsonb(old));
    end if;
    return coalesce(new, old);
end;
$$;

create trigger trg_audit_groups after insert or update or delete on public.tontine_groups
    for each row execute function public.audit_row('tontine_group');
create trigger trg_audit_members after insert or update or delete on public.members
    for each row execute function public.audit_row('member');
create trigger trg_audit_seasons after insert or update or delete on public.seasons
    for each row execute function public.audit_row('season');

create or replace function public.audit_drawing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.audit_logs (user_id, action_type, entity_type, entity_id, new_data)
    values (auth.uid(), 'drawing', 'drawing', new.id, to_jsonb(new));
    return new;
end;
$$;

create trigger trg_audit_drawings after insert on public.drawings
    for each row execute function public.audit_drawing();

-- Droits ---------------------------------------------------------------------
-- Les fonctions SECURITY DEFINER sont exécutables par les utilisateurs connectés
-- seulement. `write_beneficiary_order` et `assert_season_writable` sont internes.

revoke all on function public.write_beneficiary_order(uuid, uuid[], order_generation_mode) from public, anon, authenticated;
revoke all on function public.assert_season_writable(uuid) from public, anon, authenticated;
revoke all on function public.active_member_ids(uuid) from public, anon, authenticated;

grant execute on function public.generate_automatic_shuffle(uuid) to authenticated;
grant execute on function public.generate_manual_order(uuid, uuid[]) to authenticated;
grant execute on function public.generate_intelligent_rotation(uuid) to authenticated;
grant execute on function public.open_individual_drawing(uuid) to authenticated;
grant execute on function public.perform_individual_drawing(uuid) to authenticated;
grant execute on function public.available_drawing_numbers(uuid) to authenticated;
grant execute on function public.drawing_progress(uuid) to authenticated;
