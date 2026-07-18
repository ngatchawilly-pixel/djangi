-- =============================================================================
-- Migration 5 : recherche d'un utilisateur par email exact
--
-- RLS interdit à un admin de lire un profil qui n'est pas encore rattaché à l'un
-- de ses membres (isolation, exigence 18). Cette fonction SECURITY DEFINER
-- permet le seul cas légitime : confirmer qu'un compte existe pour une adresse
-- que l'admin s'apprête à ajouter.
--
-- Sécurité :
--   * correspondance EXACTE uniquement — pas de LIKE, pas de préfixe. Un admin
--     doit déjà connaître l'email complet, il ne peut donc pas énumérer les
--     comptes de la plateforme. Une recherche partielle rouvrirait la faille que
--     RLS ferme.
--   * réservée aux Admin / Super_Admin : un simple membre n'a pas à sonder.
--   * ne renvoie que le nom d'affichage, jamais l'id ni d'autres données.
-- =============================================================================

create or replace function public.lookup_user_by_email(p_email text)
returns table (found boolean, first_name text, last_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if public.current_user_role() not in ('Admin', 'Super_Admin') then
        raise exception 'Accès refusé' using errcode = '42501';
    end if;

    return query
    select true, p.first_name, p.last_name
    from public.profiles p
    where lower(p.email) = lower(btrim(p_email))
    limit 1;

    -- Aucun compte : une ligne « found = false » pour distinguer « pas trouvé »
    -- d'une erreur.
    if not found then
        return query select false, null::text, null::text;
    end if;
end;
$$;

revoke all on function public.lookup_user_by_email(text) from public, anon;
grant execute on function public.lookup_user_by_email(text) to authenticated;
