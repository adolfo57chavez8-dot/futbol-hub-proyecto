# Futbol Hub

Next.js 14 + Tailwind + Supabase + Gemini. Campeones, partidos (manual o por imagen) y rankings UEFA y mundial.

## Puesta en marcha
1. **Supabase** → SQL Editor: ejecuta `supabase/schema.sql` y luego `supabase/seed.sql`.
2. Copia `.env.local.example` a `.env.local` y completa las tres variables (la clave de Gemini nunca lleva `NEXT_PUBLIC_`).
3. `npm install && npm run dev`.
4. **GitHub**: `git init && git add . && git commit -m "Futbol Hub" && git remote add origin <repo> && git push -u origin main`.
5. **Vercel**: importa el repo y añade las mismas tres variables en *Settings → Environment Variables*.

## Logos
Coloca PNG con el nombre del slug: `public/logos/competiciones/champions-league.png`, `public/logos/rankings/uefa.png`, `public/logos/rankings/mundial.png`, `public/logos/copas/<slug>.png`.
Slugs: liga-italiana, copa-italia, supercopa-italia, champions-league, europa-league, conference-league, supercopa-uefa, mundial-clubes.

## Puntos de los rankings
Local/visitante = base (victoria +3, empate +1, derrota −1) × peso de competición × peso de fase × factor rival (peso rival / peso propio, entre 0.5 y 2; en derrota se invierte).
Pesos de competición en `src/lib/competitions.ts`, de fase en `STAGE_WEIGHT`, de club en la página Clubes.

## Seguridad
Las políticas RLS son abiertas (app personal). Antes de publicarla añade Supabase Auth y limita las escrituras.
