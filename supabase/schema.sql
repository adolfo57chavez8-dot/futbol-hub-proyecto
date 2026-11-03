-- FUTBOL HUB · esquema Supabase. Ejecutar primero en SQL Editor.
create table if not exists clubs (
  id bigint generated always as identity primary key,
  name text unique not null,
  country text not null default '',
  confederation text not null default 'UEFA',
  division text,
  weight numeric not null default 1,
  base_uefa numeric not null default 0,
  base_mundial numeric not null default 0,
  logo_url text,
  created_at timestamptz default now()
);
create table if not exists seasons (
  label text primary key,
  status text not null default 'activa' check (status in ('activa','finalizada')),
  created_at timestamptz default now()
);
create table if not exists tournament_status (
  season text references seasons(label) on delete cascade,
  competition text,
  finalized boolean not null default false,
  primary key (season, competition)
);
create table if not exists matches (
  id bigint generated always as identity primary key,
  competition text not null,
  season text not null references seasons(label),
  stage text not null,
  leg int not null default 1,
  home_id bigint not null references clubs(id),
  away_id bigint not null references clubs(id),
  home_score int,
  away_score int,
  pens_home int,
  pens_away int,
  created_at timestamptz default now()
);
create table if not exists titles (
  id bigint generated always as identity primary key,
  competition text not null,
  season text not null,
  club_id bigint not null references clubs(id),
  unique (competition, season)
);
create table if not exists historical_titles (
  competition text not null,
  club_id bigint not null references clubs(id),
  titles int not null,
  primary key (competition, club_id)
);
create table if not exists ranking_points (
  id bigint generated always as identity primary key,
  ranking text not null check (ranking in ('uefa','mundial')),
  club_id bigint not null references clubs(id),
  match_id bigint not null references matches(id) on delete cascade,
  points numeric not null
);

create or replace view v_titles as
select t.competition, t.club_id, c.name, c.country, sum(t.n)::int as titles
from (select competition, club_id, 1 as n from titles
      union all select competition, club_id, titles from historical_titles) t
join clubs c on c.id = t.club_id
group by t.competition, t.club_id, c.name, c.country;

create or replace view v_ranking_uefa as
select row_number() over (order by q.pts desc, q.name) as pos, q.*
from (select c.id, c.name, c.country, c.confederation,
             round(c.base_uefa + coalesce(sum(p.points),0), 2) as pts
      from clubs c left join ranking_points p on p.club_id = c.id and p.ranking = 'uefa'
      where c.confederation = 'UEFA' group by c.id) q;

create or replace view v_ranking_mundial as
select row_number() over (order by q.pts desc, q.name) as pos, q.*
from (select c.id, c.name, c.country, c.confederation,
             round(c.base_mundial + coalesce(sum(p.points),0), 2) as pts
      from clubs c left join ranking_points p on p.club_id = c.id and p.ranking = 'mundial'
      group by c.id) q;

-- Acceso abierto (app personal). Para producción añade Supabase Auth y restringe escrituras.
do $$ declare t text; begin
  for t in select unnest(array['clubs','seasons','tournament_status','matches','titles','historical_titles','ranking_points']) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists open_all on %I', t);
    execute format('create policy open_all on %I for all using (true) with check (true)', t);
  end loop; end $$;
grant select on v_titles, v_ranking_uefa, v_ranking_mundial to anon, authenticated;
