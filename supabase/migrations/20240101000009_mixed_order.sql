-- =============================================================================
-- Migration 10 : ordre de passage MIXTE
--
-- L'admin épingle certains membres à des positions précises, le reste est
-- complété automatiquement :
--   * p_fill = 'shuffle'  -> les non-épinglés sont mélangés dans les positions
--                            restantes, immédiatement.
--   * p_fill = 'drawing'  -> les non-épinglés tirent eux-mêmes parmi les numéros
--                            restants (les épinglés sont pré-inscrits comme des
--                            tirages déjà faits, donc leurs numéros sortent du
--                            pool et ils ne peuvent pas retirer).
--
-- Aucune modification de schéma : on réutilise `drawings` et `beneficiary_orders`
-- ainsi que les modes d'énumération existants. Le caractère « mixte » est un
-- détail de fabrication ; l'ordre produit est identique aux autres modes.
--
-- p_pins : jsonb [{"member_id":"<uuid>","position":<int>}, ...]
-- =============================================================================

create or replace function public.generate_mixed_order(
    p_season_id uuid,
    p_pins      jsonb,
    p_fill      text
)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_group   uuid;
    v_members uuid[];
    v_n       int;
    v_pin_m   uuid[] := '{}';   -- membres épinglés
    v_pin_p   int[]  := '{}';   -- positions épinglées (même index que v_pin_m)
    v_free_m  uuid[];           -- membres à compléter
    v_free_p  int[];            -- positions libres, croissantes
    v_order   uuid[];
    v_pins    int;
    v_free    int;
    e         jsonb;
    v_m       uuid;
    v_p       int;
    i         int;
    j         int;
    tmp       uuid;
begin
    if p_fill not in ('shuffle', 'drawing') then
        return query select false, 'Mode de complétion invalide'::text;
        return;
    end if;

    v_group   := public.assert_season_writable(p_season_id);
    v_members := public.active_member_ids(v_group);
    v_n       := coalesce(array_length(v_members, 1), 0);

    if v_n < 2 then
        return query select false, 'Il faut au moins 2 membres actifs'::text;
        return;
    end if;

    -- Analyse et validation des épingles ------------------------------------
    for e in select * from jsonb_array_elements(coalesce(p_pins, '[]'::jsonb)) loop
        v_m := (e ->> 'member_id')::uuid;
        v_p := (e ->> 'position')::int;

        if v_p < 1 or v_p > v_n then
            return query select false,
                format('Position %s hors plage (1..%s)', v_p, v_n)::text;
            return;
        end if;
        if not (v_m = any(v_members)) then
            return query select false,
                'Un membre épinglé n''est pas actif dans ce groupe'::text;
            return;
        end if;
        if v_m = any(v_pin_m) then
            return query select false, 'Un membre est épinglé plusieurs fois'::text;
            return;
        end if;
        if v_p = any(v_pin_p) then
            return query select false,
                format('La position %s est attribuée deux fois', v_p)::text;
            return;
        end if;

        v_pin_m := array_append(v_pin_m, v_m);
        v_pin_p := array_append(v_pin_p, v_p);
    end loop;

    v_pins := coalesce(array_length(v_pin_m, 1), 0);

    -- Tout est épinglé : rien à compléter, on écrit l'ordre tel quel.
    if v_pins = v_n then
        v_order := array_fill(null::uuid, array[v_n]);
        for i in 1 .. v_pins loop
            v_order[v_pin_p[i]] := v_pin_m[i];
        end loop;
        perform public.write_beneficiary_order(p_season_id, v_order, 'manual');
        return query select true, 'Ordre entièrement défini à la main'::text;
        return;
    end if;

    -- Membres et positions restants
    select array_agg(m) into v_free_m
    from unnest(v_members) m
    where not (m = any(v_pin_m));

    select array_agg(p order by p) into v_free_p
    from generate_series(1, v_n) p
    where not (p = any(v_pin_p));

    v_free := array_length(v_free_m, 1);

    if p_fill = 'shuffle' then
        -- Fisher-Yates sur les membres libres.
        if v_free >= 2 then
            for i in reverse v_free .. 2 loop
                j := public.secure_random_int(1, i);
                tmp := v_free_m[i];
                v_free_m[i] := v_free_m[j];
                v_free_m[j] := tmp;
            end loop;
        end if;

        v_order := array_fill(null::uuid, array[v_n]);
        for i in 1 .. v_pins loop
            v_order[v_pin_p[i]] := v_pin_m[i];
        end loop;
        for i in 1 .. v_free loop
            v_order[v_free_p[i]] := v_free_m[i];
        end loop;

        perform public.write_beneficiary_order(p_season_id, v_order, 'automatic_shuffle');
        return query select true,
            format('Ordre mixte généré : %s épinglé(s), %s mélangé(s)', v_pins, v_free)::text;
        return;
    else
        -- p_fill = 'drawing' : ouvrir le tirage pour les non-épinglés.
        update public.seasons
        set status = 'drawing',
            generation_mode = 'individual_drawing',
            expected_member_count = v_n
        where id = p_season_id;

        -- Les épinglés sont pré-inscrits : leur numéro sort du pool et ils ne
        -- pourront pas retirer (perform_individual_drawing les voit « déjà tirés »).
        for i in 1 .. v_pins loop
            insert into public.drawings (season_id, member_id, drawn_number)
            values (p_season_id, v_pin_m[i], v_pin_p[i]);
        end loop;

        return query select true,
            format('Tirage mixte ouvert : %s épinglé(s), %s à tirer', v_pins, v_free)::text;
        return;
    end if;
end;
$$;

grant execute on function public.generate_mixed_order(uuid, jsonb, text) to authenticated;
