export type Scope = "IT" | "UEFA" | "MUNDIAL";
export type Comp = {
  slug: string; name: string; scope: Scope; stages: string[]; twoLegs: string[];
  manualChampion?: boolean; ranking?: "uefa" | "mundial"; weight: number; blurb: string;
};
const UEFA_STAGES = ["fase-liga", "playoff", "octavos", "cuartos", "semifinal", "final"];
const UEFA_TWO = ["playoff", "octavos", "cuartos", "semifinal"];
export const COMPS: Comp[] = [
  { slug: "liga-italiana", name: "Liga Italiana", scope: "IT", stages: [], twoLegs: [], manualChampion: true, weight: 0, blurb: "Campeones de Serie A" },
  { slug: "copa-italia", name: "Copa Italia", scope: "IT", stages: ["dieciseisavos", "octavos", "cuartos", "semifinal", "final"], twoLegs: [], weight: 0, blurb: "Eliminatoria directa hasta la final" },
  { slug: "supercopa-italia", name: "Supercopa Italiana", scope: "IT", stages: ["final"], twoLegs: [], weight: 0, blurb: "Partido único" },
  { slug: "champions-league", name: "Champions League", scope: "UEFA", stages: UEFA_STAGES, twoLegs: UEFA_TWO, ranking: "uefa", weight: 1, blurb: "36 clubes · fase de liga de 8 partidos" },
  { slug: "europa-league", name: "UEFA Europa League", scope: "UEFA", stages: UEFA_STAGES, twoLegs: UEFA_TWO, ranking: "uefa", weight: 0.7, blurb: "Segunda competición europea" },
  { slug: "conference-league", name: "UEFA Conference League", scope: "UEFA", stages: UEFA_STAGES, twoLegs: UEFA_TWO, ranking: "uefa", weight: 0.5, blurb: "Tercera competición europea" },
  { slug: "supercopa-uefa", name: "Supercopa de la UEFA", scope: "UEFA", stages: ["final"], twoLegs: [], ranking: "uefa", weight: 0.6, blurb: "Campeón de Champions vs Europa League" },
  { slug: "mundial-clubes", name: "Mundial de Clubes", scope: "MUNDIAL", stages: ["preliminar", "cuartos", "semifinal", "tercer-puesto", "final"], twoLegs: [], ranking: "mundial", weight: 1.2, blurb: "Formato clásico, clubes nuevos permitidos" },
];
export const STAGE_LABEL: Record<string, string> = {
  "fase-liga": "Fase de liga", playoff: "Play-offs", dieciseisavos: "Dieciseisavos", octavos: "Octavos de final",
  cuartos: "Cuartos de final", semifinal: "Semifinal", final: "Final", preliminar: "Ronda preliminar", "tercer-puesto": "Tercer puesto",
};
export const STAGE_WEIGHT: Record<string, number> = {
  "fase-liga": 1, playoff: 1.2, dieciseisavos: 1, preliminar: 1, octavos: 1.4, cuartos: 1.7, semifinal: 2, "tercer-puesto": 1.2, final: 2.5,
};
export const getComp = (slug: string) => COMPS.find((c) => c.slug === slug);
