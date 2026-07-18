-- =============================================================================
-- Migration 9 : transitions de cycle de vie d'une saison
--
-- Deux transitions manquaient, et aucune policy RLS ne les autorisait (seules
-- les saisons en brouillon étaient modifiables) :
--
--   * clôturer une saison finalisée (active -> completed). Sans elle,
--     generate_intelligent_rotation ne trouve jamais de « saison précédente
--     terminée » : le mode rotation était inutilisable.
--   * annuler un tirage individuel ouvert (drawing -> draft). Sans elle, une
--     saison passée en tirage restait bloquée à vie si l'admin voulait changer
--     de mode ou repartir de zéro.
--
-- Les deux passent par des fonctions SECURITY DEFINER qui vérifient le
-- propriétaire, plutôt que par de nouvelles policies UPDATE larges.
-- =============================================================================

-- Clôturer une saison finalisée --------------------------------------------
create or replace function public.complete_season(p_season_id uuid)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group  uuid;
    v_status season_status;
begin
    select group_id, status into v_group, v_status
    from public.seasons where id = p_season_id;

    if v_group is null then
        return query select false, 'Saison introuvable'::text;
        return;
    end if;
    if not public.owns_group(v_group) then
        raise exception 'Accès refusé' using errcode = '42501';
    end if;
    if v_status <> 'active' then
        return query select false,
            'Seule une saison finalisée peut être clôturée'::text;
        return;
    end if;

    update public.seasons set status = 'completed' where id = p_season_id;
    return query select true, 'Saison clôturée'::text;
end;
$$;

-- Annuler un tirage individuel ouvert --------------------------------------
-- Remet la saison en brouillon et efface les tirages déjà faits, pour que
-- l'admin puisse rouvrir un tirage ou choisir un autre mode.
create or replace function public.cancel_drawing(p_season_id uuid)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group  uuid;
    v_status season_status;
begin
    select group_id, status into v_group, v_status
    from public.seasons where id = p_season_id;

    if v_group is null then
        return query select false, 'Saison introuvable'::text;
        return;
    end if;
    if not public.owns_group(v_group) then
        raise exception 'Accès refusé' using errcode = '42501';
    end if;
    if v_status <> 'drawing' then
        return query select false,
            'Seul un tirage en cours peut être annulé'::text;
        return;
    end if;

    delete from public.drawings where season_id = p_season_id;
    update public.seasons
    set status = 'draft', generation_mode = null, expected_member_count = null
    where id = p_season_id;

    return query select true, 'Tirage annulé, la saison est revenue en brouillon'::text;
end;
$$;

grant execute on function public.complete_season(uuid) to authenticated;
grant execute on function public.cancel_drawing(uuid) to authenticated;
