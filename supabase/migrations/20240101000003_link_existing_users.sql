-- =============================================================================
-- Migration 4 : rattacher une fiche membre à un compte DÉJÀ existant
--
-- Bug corrigé : le rattachement ne se faisait que dans handle_new_user(), donc
-- uniquement à l'inscription. Si un utilisateur avait déjà un compte au moment
-- où l'admin l'ajoutait au groupe, members.user_id restait NULL indéfiniment et
-- le membre ne pouvait jamais tirer son numéro (exigence 6.1).
--
-- Le lien doit fonctionner dans les deux sens :
--   * compte créé APRÈS la fiche  -> handle_new_user()            (migration 3)
--   * compte créé AVANT la fiche  -> link_member_to_existing_user() (ici)
-- =============================================================================

-- Un même compte ne peut pas avoir deux fiches dans le même groupe. L'index est
-- partiel : les fiches sans compte (user_id NULL) restent librement multiples.
create unique index if not exists unique_user_per_group
    on public.members (group_id, user_id)
    where user_id is not null;

create or replace function public.link_member_to_existing_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
begin
    -- Ne jamais écraser un rattachement déjà posé.
    if new.email is null or new.user_id is not null then
        return new;
    end if;

    select id into v_user_id
    from public.profiles
    where lower(email) = lower(new.email);

    if v_user_id is null then
        return new;
    end if;

    -- Le compte est-il déjà rattaché à une autre fiche de ce groupe ? Si oui, on
    -- laisse user_id à NULL plutôt que de violer unique_user_per_group et de
    -- faire échouer tout l'INSERT : l'admin verra la fiche « sans compte » et
    -- pourra corriger l'email.
    if exists (
        select 1 from public.members m
        where m.group_id = new.group_id
          and m.user_id = v_user_id
          and m.id is distinct from new.id
    ) then
        return new;
    end if;

    new.user_id := v_user_id;
    return new;
end;
$$;

create trigger trg_members_link_existing_user
    before insert or update of email on public.members
    for each row execute function public.link_member_to_existing_user();

-- Rattrapage des fiches déjà créées sans compte (dont les 12 membres insérés à
-- la main). Le DISTINCT ON évite d'affecter deux fois le même compte au même
-- groupe, ce que l'index refuserait.
with candidates as (
    select distinct on (m.group_id, p.id)
        m.id as member_id,
        p.id as user_id
    from public.members m
    join public.profiles p on lower(p.email) = lower(m.email)
    where m.user_id is null
      and m.email is not null
      and not exists (
          select 1 from public.members m2
          where m2.group_id = m.group_id and m2.user_id = p.id
      )
    order by m.group_id, p.id, m.created_at
)
update public.members m
set user_id = c.user_id
from candidates c
where m.id = c.member_id;
