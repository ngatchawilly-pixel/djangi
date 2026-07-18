-- =============================================================================
-- Migration 8 : corriger l'ambiguïté « drawn_number » dans le tirage
--
-- Bug : « column reference "drawn_number" is ambiguous » au moment où le dernier
-- membre tire (finalisation automatique de l'ordre).
--
-- Cause : perform_individual_drawing() a un paramètre de sortie nommé
-- `drawn_number` (RETURNS TABLE(drawn_number ...)). Dans le sous-select de
-- finalisation, `order by drawn_number` pouvait désigner soit ce paramètre, soit
-- la colonne drawings.drawn_number. PostgreSQL refuse l'ambiguïté.
--
-- Correctif : qualifier la colonne (d.drawn_number, d.member_id).
-- =============================================================================

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

    -- Verrou sur la saison : sérialise les tirages concurrents.
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
