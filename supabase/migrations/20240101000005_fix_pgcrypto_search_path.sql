-- =============================================================================
-- Migration 6 : corriger l'accès à pgcrypto (gen_random_bytes)
--
-- Bug : « function gen_random_bytes(integer) does not exist » au moment du
-- tirage et du mélange automatique.
--
-- Cause : Supabase installe l'extension pgcrypto dans le schéma `extensions`,
-- pas `public`. Or secure_random_int() héritait du search_path `public, pg_temp`
-- fixé par ses fonctions appelantes (SECURITY DEFINER), qui n'inclut pas
-- `extensions`. gen_random_bytes() était donc introuvable.
--
-- Correctif : donner à secure_random_int() son propre search_path incluant
-- `extensions`. On qualifie aussi l'appel en dur par sécurité, au cas où la
-- fonction serait appelée dans un contexte au search_path encore plus réduit.
-- =============================================================================

-- S'assure que l'extension est disponible (no-op si déjà installée).
create extension if not exists pgcrypto with schema extensions;

create or replace function public.secure_random_int(min_val int, max_val int)
returns int
language plpgsql
volatile
set search_path = public, extensions, pg_temp
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
        -- Qualifié explicitement : robuste même si le search_path est réduit.
        v_bytes := extensions.gen_random_bytes(4);
        v_rand := (get_byte(v_bytes, 0)::bigint << 24)
                | (get_byte(v_bytes, 1)::bigint << 16)
                | (get_byte(v_bytes, 2)::bigint << 8)
                |  get_byte(v_bytes, 3)::bigint;
        exit when v_rand < v_limit;
    end loop;

    return min_val + (v_rand % v_range)::int;
end;
$$;
