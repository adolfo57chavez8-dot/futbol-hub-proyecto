import { sb } from "./supabase";
import { Comp, Scope } from "./competitions";
import { matchPoints } from "./points";

export type Row = {
  season: string; stage: string; leg: number;
  home: string; away: string; homeId: number | null; awayId: number | null;
  hs: number | null; as: number | null; ph: number | null; pa: number | null;
};

export function normSeason(x: any): string {
  const m = String(x ?? "").match(/(\d{2,4})\D+(\d{2,4})/);
  if (!m) return "";
  let y = Number(m[1]);
  if (m[1].length === 2) y = y <= 26 ? 2000 + y : 1900 + y;
  const e = String((y + 1) % 100).padStart(2, "0");
  return y >= 2000 ? `${String(y % 100).padStart(2, "0")}-${e}` : `${y}-${e}`;
}
export const seasonKey = (l: string) => { const y = Number(l.split("-")[0]); return y < 100 ? 2000 + y : y; };

/* ---------- Reconocimiento de clubes por nombre ---------- */
const STOP = new Set(["fc", "cf", "ac", "as", "ss", "ssc", "sc", "sv", "fk", "cd", "ud", "us", "rcd", "afc", "bk", "the", "club", "de", "del", "calcio"]);
const ALIAS: Record<string, string> = { napoles: "napoli", bolonia: "bologna", munchen: "munich", turin: "", internazionale: "inter", genova: "genoa", lisboa: "lisboa" };
const tokens = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter((t) => t && !STOP.has(t)).map((t) => ALIAS[t] ?? t).filter(Boolean);

/** Busca el club en la lista. Si hay una única coincidencia clara devuelve su id; si no, sugiere candidatos. */
export function matchClub(name: string, pool: any[]): { id: number | null; candidates: any[] } {
  const q = tokens(name);
  if (!q.length) return { id: null, candidates: [] };
  const key = q.join(" ");
  const exact = pool.find((c) => tokens(c.name).join(" ") === key);
  if (exact) return { id: exact.id, candidates: [] };
  const qs = new Set(q);
  const sub = (a: string[], b: Set<string>) => a.length > 0 && a.every((x) => b.has(x));
  const cand = pool.filter((c) => { const t = tokens(c.name); return sub(t, qs) || sub(q, new Set(t)); });
  return cand.length === 1 ? { id: cand[0].id, candidates: [] } : { id: null, candidates: cand.slice(0, 4) };
}

export async function createClub(name: string, scope: Scope) {
  const { data, error } = await sb.from("clubs")
    .insert({ name: name.trim(), country: scope === "IT" ? "Italia" : "", confederation: scope === "MUNDIAL" ? "Otra" : "UEFA" })
    .select("id,name").single();
  if (error) throw new Error(error.code === "23505" ? `Ya existe un club llamado «${name.trim()}»` : error.message);
  return data as { id: number; name: string };
}

export async function ensureClub(name: string, scope: Scope) {
  const n = name.trim();
  const { data } = await sb.from("clubs").select("id,weight").ilike("name", n).maybeSingle();
  if (data) return data;
  const { data: c, error } = await sb.from("clubs")
    .insert({ name: n, country: scope === "IT" ? "Italia" : "", confederation: scope === "MUNDIAL" ? "Otra" : "UEFA" })
    .select("id,weight").single();
  if (error) throw error;
  return c;
}

/* ---------- Validación y guardado de partidos ---------- */
export function validate(comp: Comp, r: Row) {
  if (!/^(\d{2}|\d{4})-\d{2}$/.test(r.season)) return "Temporada inválida (usa 25-26)";
  if (!r.homeId || !r.awayId) return "Elige o crea el club local y el visitante";
  if (r.homeId === r.awayId) return "Local y visitante son el mismo club";
  if ((r.hs == null) !== (r.as == null)) return "Completa los goles de ambos equipos";
  if ((r.ph == null) !== (r.pa == null)) return "Completa ambos marcadores de penales";
  const hasScore = r.hs != null, hasPens = r.ph != null;
  if (!hasScore && !hasPens) return "Falta el marcador o los penales";
  if (hasPens && r.ph === r.pa) return "Los penales no pueden terminar empatados";
  if (hasPens && hasScore && r.hs !== r.as && !comp.twoLegs.includes(r.stage)) return "Con penales el marcador normal debe ser empate";
  if (r.stage === "final" && !hasPens && r.hs === r.as) return "Una final empatada necesita penales";
  return "";
}

export async function saveMatches(comp: Comp, season: string, rows: Row[]) {
  const ids = Array.from(new Set(rows.flatMap((r) => [r.homeId!, r.awayId!])));
  const { data: cl } = await sb.from("clubs").select("id,weight").in("id", ids);
  const w: Record<number, number> = Object.fromEntries((cl || []).map((c: any) => [c.id, Number(c.weight) || 1]));
  for (const r of rows) {
    const s = r.season || season;
    await sb.from("seasons").upsert({ label: s, status: "finalizada" }, { onConflict: "label", ignoreDuplicates: true });
    const { data: m, error } = await sb.from("matches").insert({
      competition: comp.slug, season: s, stage: r.stage, leg: r.leg, home_id: r.homeId, away_id: r.awayId,
      home_score: r.hs, away_score: r.as, pens_home: r.ph, pens_away: r.pa,
    }).select("id").single();
    if (error) throw error;
    const hs = r.hs ?? 0, as = r.as ?? 0;
    if (comp.ranking) {
      const [ph, pa] = matchPoints(comp, r.stage, hs, as, w[r.homeId!], w[r.awayId!]);
      await sb.from("ranking_points").insert([
        { ranking: comp.ranking, club_id: r.homeId, match_id: m.id, points: ph },
        { ranking: comp.ranking, club_id: r.awayId, match_id: m.id, points: pa },
      ]);
    }
    if (r.stage === "final") {
      const homeWins = hs > as || (hs === as && (r.ph ?? 0) > (r.pa ?? 0));
      await sb.from("titles").upsert({ competition: comp.slug, season: s, club_id: homeWins ? r.homeId : r.awayId }, { onConflict: "competition,season" });
    }
  }
}

export async function addChampion(comp: Comp, season: string, club: string) {
  const c = await ensureClub(club, comp.scope);
  const { error } = await sb.from("titles").upsert({ competition: comp.slug, season, club_id: c.id }, { onConflict: "competition,season" });
  if (error) throw error;
}

export async function extract(file: File, kind: "matches" | "champion" | "clubs" | "ranking") {
  const image = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.onerror = () => rej(new Error("No se pudo leer la imagen"));
    fr.readAsDataURL(file);
  });
  const r = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, mime: file.type || "image/png", kind }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Error al leer la imagen");
  return j;
}
