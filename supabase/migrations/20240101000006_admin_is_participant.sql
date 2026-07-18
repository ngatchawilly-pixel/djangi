-- =============================================================================
-- Migration 7 : le créateur d'un groupe en est d'office un participant
--
-- Règle métier : dans une tontine, l'organisateur cotise en général lui aussi.
-- À la création d'un groupe, une fiche membre est donc créée pour l'admin,
-- rattachée à son compte (user_id = admin_id) — il peut ainsi tirer son numéro
-- comme les autres.
--
-- Réversible : l'admin qui ne participe pas peut retirer sa propre fiche ou la
-- passer en statut « parti » depuis la liste des membres.
-- =============================================================================

create or replace function public.add_admin_as_participant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_email text;
    v_first text;
    v_last  text;
begin
    select
        p.email,
        -- first_name/last_name sont NOT NULL sur members : on prévoit un repli
        -- si le profil est incomplet.
        coalesce(nullif(btrim(p.first_name), ''), split_part(p.email, '@', 1)),
        coalesce(nullif(btrim(p.last_name), ''), '')
    into v_email, v_first, v_last
    from public.profiles p
    where p.id = new.admin_id;

    insert into public.members (group_id, user_id, first_name, last_name, email, status)
    values (new.id, new.admin_id, v_first, v_last, v_email, 'active')
    -- Idempotent : si une fiche avec cet email existe déjà dans le groupe, on
    -- ne fait rien plutôt que de faire échouer la création du groupe.
    on conflict (group_id, email) do nothing;

    return new;
end;
$$;

create trigger trg_group_add_admin
    after insert on public.tontine_groups
    for each row execute function public.add_admin_as_participant();

-- Rattrapage : ajoute l'admin comme membre dans ses groupes déjà créés (dont
-- « test1 ») s'il n'y figure pas encore.
insert into public.members (group_id, user_id, first_name, last_name, email, status)
select
    g.id,
    g.admin_id,
    coalesce(nullif(btrim(p.first_name), ''), split_part(p.email, '@', 1)),
    coalesce(nullif(btrim(p.last_name), ''), ''),
    p.email,
    'active'
from public.tontine_groups g
join public.profiles p on p.id = g.admin_id
where not exists (
    select 1 from public.members m
    where m.group_id = g.id and m.user_id = g.admin_id
)
on conflict (group_id, email) do nothing;
