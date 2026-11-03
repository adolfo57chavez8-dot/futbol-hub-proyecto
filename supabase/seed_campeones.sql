-- OBSOLETO: reemplazado por seed_finales.sql (no ejecutar).
-- Ejecutar UNA vez, después de schema.sql y seed.sql.
insert into clubs(name,country,confederation) values
('Vado','Italia','UEFA'),('Eintracht Frankfurt','Alemania','UEFA'),('IFK Gotemburgo','Suecia','UEFA'),
('Borussia Mönchengladbach','Alemania','UEFA'),('Villarreal','España','UEFA'),('Shakhtar Donetsk','Ucrania','UEFA'),
('Zenit San Petersburgo','Rusia','UEFA'),('CSKA Moscú','Rusia','UEFA'),('Galatasaray','Turquía','UEFA'),
('Schalke 04','Alemania','UEFA'),('Bayer Leverkusen','Alemania','UEFA'),('Anderlecht','Bélgica','UEFA'),
('Ipswich Town','Inglaterra','UEFA'),('Crystal Palace','Inglaterra','UEFA'),('West Ham','Inglaterra','UEFA'),
('Rayo Vallecano','España','UEFA'),('Real Betis','España','UEFA'),('Olympiacos','Grecia','UEFA'),
('Mechelen','Bélgica','UEFA'),('Aberdeen','Escocia','UEFA'),('Dinamo de Kiev','Ucrania','UEFA')
on conflict (name) do nothing;

-- Títulos por competición (conteos de tus tablas de campeones).
insert into historical_titles(competition, club_id, titles)
select v.c, cl.id, v.n from (values
('copa-italia','Juventus',15),('copa-italia','Inter',9),('copa-italia','Roma',9),('copa-italia','Lazio',7),
('copa-italia','Napoli',6),('copa-italia','Fiorentina',6),('copa-italia','Milan',5),('copa-italia','Torino',5),
('copa-italia','Sampdoria',4),('copa-italia','Bologna',3),('copa-italia','Parma',3),('copa-italia','Vicenza',1),
('copa-italia','Atalanta',1),('copa-italia','Venezia',1),('copa-italia','Genoa',1),('copa-italia','Vado',1),
('supercopa-italia','Juventus',9),('supercopa-italia','Milan',8),('supercopa-italia','Inter',8),('supercopa-italia','Lazio',5),
('supercopa-italia','Napoli',3),('supercopa-italia','Roma',2),('supercopa-italia','Parma',1),('supercopa-italia','Fiorentina',1),
('supercopa-italia','Sampdoria',1),
('europa-league','Sevilla',7),('europa-league','Tottenham',3),('europa-league','Atlético de Madrid',3),('europa-league','Liverpool',3),
('europa-league','Inter',3),('europa-league','Juventus',3),('europa-league','Eintracht Frankfurt',2),('europa-league','Chelsea',2),
('europa-league','Porto',2),('europa-league','Feyenoord',2),('europa-league','Parma',2),('europa-league','IFK Gotemburgo',2),
('europa-league','Real Madrid',2),('europa-league','Borussia Mönchengladbach',2),('europa-league','Aston Villa',1),
('europa-league','Atalanta',1),('europa-league','Villarreal',1),('europa-league','Manchester United',1),('europa-league','Shakhtar Donetsk',1),
('europa-league','Zenit San Petersburgo',1),('europa-league','CSKA Moscú',1),('europa-league','Valencia',1),('europa-league','Galatasaray',1),
('europa-league','Schalke 04',1),('europa-league','Bayern Múnich',1),('europa-league','Ajax',1),('europa-league','Napoli',1),
('europa-league','Bayer Leverkusen',1),('europa-league','Anderlecht',1),('europa-league','Ipswich Town',1),('europa-league','PSV Eindhoven',1),
('supercopa-uefa','Real Madrid',6),('supercopa-uefa','Barcelona',5),('supercopa-uefa','Milan',5),('supercopa-uefa','Liverpool',4),
('supercopa-uefa','Atlético de Madrid',3),('supercopa-uefa','Ajax',3),('supercopa-uefa','Paris Saint-Germain',2),('supercopa-uefa','Chelsea',2),
('supercopa-uefa','Bayern Múnich',2),('supercopa-uefa','Valencia',2),('supercopa-uefa','Juventus',2),('supercopa-uefa','Anderlecht',2),
('supercopa-uefa','Manchester City',1),('supercopa-uefa','Zenit San Petersburgo',1),('supercopa-uefa','Sevilla',1),('supercopa-uefa','Galatasaray',1),
('supercopa-uefa','Lazio',1),('supercopa-uefa','Parma',1),('supercopa-uefa','Manchester United',1),('supercopa-uefa','Mechelen',1),
('supercopa-uefa','Porto',1),('supercopa-uefa','Steaua de Bucarest',1),('supercopa-uefa','Aberdeen',1),('supercopa-uefa','Aston Villa',1),
('supercopa-uefa','Nottingham Forest',1),('supercopa-uefa','Dinamo de Kiev',1)
) v(c,name,n) join clubs cl on cl.name = v.name
on conflict do nothing;

-- Conference League: las 5 finales completas (sus campeones salen de aquí, no de historical_titles).
insert into seasons(label,status) values ('21-22','finalizada'),('22-23','finalizada'),('23-24','finalizada'),('24-25','finalizada'),('25-26','finalizada') on conflict do nothing;
insert into matches(competition,season,stage,home_id,away_id,home_score,away_score)
select 'conference-league', v.s, 'final', h.id, a.id, v.hs, v.as_
from (values ('25-26','Crystal Palace','Rayo Vallecano',1,0),('24-25','Real Betis','Chelsea',1,4),
 ('23-24','Olympiacos','Fiorentina',1,0),('22-23','Fiorentina','West Ham',1,2),('21-22','Roma','Feyenoord',1,0)) v(s,h,a,hs,as_)
join clubs h on h.name=v.h join clubs a on a.name=v.a;
insert into titles(competition,season,club_id)
select 'conference-league', v.s, c.id from (values ('25-26','Crystal Palace'),('24-25','Chelsea'),('23-24','Olympiacos'),('22-23','West Ham'),('21-22','Roma')) v(s,n)
join clubs c on c.name=v.n on conflict do nothing;
