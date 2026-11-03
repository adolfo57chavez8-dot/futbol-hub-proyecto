-- Ejecutar después de schema.sql
insert into seasons(label,status) values ('26-27','activa') on conflict do nothing;

insert into clubs(name,country,confederation,weight) values
('Juventus','Italia','UEFA',1.3),('Inter','Italia','UEFA',1.6),('Milan','Italia','UEFA',1.3),
('Genoa','Italia','UEFA',1),('Torino','Italia','UEFA',1),('Bologna','Italia','UEFA',1),
('Pro Vercelli','Italia','UEFA',1),('Napoli','Italia','UEFA',1.3),('Roma','Italia','UEFA',1.1),
('Lazio','Italia','UEFA',1.1),('Fiorentina','Italia','UEFA',1.1),('Sampdoria','Italia','UEFA',1),
('Hellas Verona','Italia','UEFA',1),('Cagliari','Italia','UEFA',1),('Novese','Italia','UEFA',1),
('Casale','Italia','UEFA',1),('Atalanta','Italia','UEFA',1.2),('Parma','Italia','UEFA',1),
('Vicenza','Italia','UEFA',1),('Venezia','Italia','UEFA',1),
('Real Madrid','España','UEFA',1.7),('Barcelona','España','UEFA',1.6),('Atlético de Madrid','España','UEFA',1.3),
('Sevilla','España','UEFA',1.1),('Valencia','España','UEFA',1),
('Bayern Múnich','Alemania','UEFA',1.6),('Borussia Dortmund','Alemania','UEFA',1.3),('Hamburgo','Alemania','UEFA',1),
('Liverpool','Inglaterra','UEFA',1.6),('Manchester City','Inglaterra','UEFA',1.7),('Manchester United','Inglaterra','UEFA',1.3),
('Chelsea','Inglaterra','UEFA',1.4),('Arsenal','Inglaterra','UEFA',1.6),('Tottenham','Inglaterra','UEFA',1.2),
('Aston Villa','Inglaterra','UEFA',1.1),('Nottingham Forest','Inglaterra','UEFA',1),
('Paris Saint-Germain','Francia','UEFA',1.6),('Olympique de Marsella','Francia','UEFA',1.1),
('Ajax','Países Bajos','UEFA',1.2),('PSV Eindhoven','Países Bajos','UEFA',1.1),('Feyenoord','Países Bajos','UEFA',1.1),
('Benfica','Portugal','UEFA',1.2),('Porto','Portugal','UEFA',1.2),
('Estrella Roja','Serbia','UEFA',1),('Steaua de Bucarest','Rumania','UEFA',1),('Celtic','Escocia','UEFA',1),
('Corinthians','Brasil','CONMEBOL',1.2),('Internacional','Brasil','CONMEBOL',1.1),('São Paulo','Brasil','CONMEBOL',1.1),
('Palmeiras','Brasil','CONMEBOL',1.3),('Flamengo','Brasil','CONMEBOL',1.3),('LDU Quito','Ecuador','CONMEBOL',1),
('Al Hilal','Arabia Saudita','AFC',1.1),('Monterrey','México','CONCACAF',1.1),('Al Ahly','Egipto','CAF',1.1)
on conflict (name) do nothing;

-- Puntos base verificados (ranking FIFA para el Mundial de Clubes 2029, abril 2026).
-- El resto arranca en 0: cárgalos con "Cargar desde imagen" en /ranking/mundial.
update clubs set base_mundial = 103 where name = 'Arsenal';
update clubs set base_mundial = 53 where name = 'Palmeiras';
update clubs set base_mundial = 51 where name = 'Flamengo';
update clubs set base_mundial = 44 where name = 'LDU Quito';

-- Títulos históricos tomados de tus capturas legibles (Serie A, Champions, Mundial de clubes).
insert into historical_titles(competition, club_id, titles)
select v.c, cl.id, v.n from (values
('liga-italiana','Juventus',36),('liga-italiana','Inter',21),('liga-italiana','Milan',19),('liga-italiana','Genoa',9),
('liga-italiana','Torino',7),('liga-italiana','Bologna',7),('liga-italiana','Pro Vercelli',7),('liga-italiana','Napoli',4),
('liga-italiana','Roma',3),('liga-italiana','Lazio',2),('liga-italiana','Fiorentina',2),('liga-italiana','Sampdoria',1),
('liga-italiana','Hellas Verona',1),('liga-italiana','Cagliari',1),('liga-italiana','Novese',1),('liga-italiana','Casale',1),
('champions-league','Real Madrid',15),('champions-league','Milan',7),('champions-league','Bayern Múnich',6),
('champions-league','Liverpool',6),('champions-league','Barcelona',5),('champions-league','Ajax',4),
('champions-league','Inter',3),('champions-league','Manchester United',3),('champions-league','Paris Saint-Germain',2),
('champions-league','Chelsea',2),('champions-league','Porto',2),('champions-league','Juventus',2),
('champions-league','Nottingham Forest',2),('champions-league','Benfica',2),('champions-league','Manchester City',1),
('champions-league','Borussia Dortmund',1),('champions-league','Olympique de Marsella',1),('champions-league','Estrella Roja',1),
('champions-league','PSV Eindhoven',1),('champions-league','Steaua de Bucarest',1),('champions-league','Hamburgo',1),
('champions-league','Aston Villa',1),('champions-league','Feyenoord',1),('champions-league','Celtic',1),
('mundial-clubes','Real Madrid',5),('mundial-clubes','Barcelona',3),('mundial-clubes','Chelsea',2),
('mundial-clubes','Bayern Múnich',2),('mundial-clubes','Corinthians',2),('mundial-clubes','Manchester City',1),
('mundial-clubes','Liverpool',1),('mundial-clubes','Inter',1),('mundial-clubes','Manchester United',1),
('mundial-clubes','Milan',1),('mundial-clubes','Internacional',1),('mundial-clubes','São Paulo',1)
) v(c,name,n) join clubs cl on cl.name = v.name
on conflict do nothing;
