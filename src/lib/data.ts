import { sb } from "./supabase";
import { Comp, Scope } from "./competitions";
import { matchPoints } from "./points";

export type Row = { season: string; stage: string; leg: number; home: string; away: string; hs: number | null; as: number | null; ph: number | null; pa: number | null };

export function normSeason(x: any): string {
  const m = String(x ?? "").match(/(\d{2,4})\D+(\d{2,4})/);
  if (!m) return "";
  let y = Number(m[1]);
  if (m[1].length === 2) y = y <= 26 ? 2000 + y : 1900 + y;
  const e = String((y + 1) % 100).padStart(2, "0");
  return y >= 2000 ? `${String(y % 100).padStart(2, "0")}-${e}` : `${y}-${e}`;
}
export const seasonKey = (l: string) => { const y = Number(l.split("-")[0]); return y < 100 ? 2000 + y : y; };

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

export function validate(comp: Comp, r: Row) {
  if (!/^(\d{2}|\d{4})-\d{2}$/.test(r.season)) return "Temporada inválida (usa 25-26)";
  if (!r.home.trim() || !r.away.trim()) return "Falta el club local o visitante";
  if (r.home.trim().toLowerCase() === r.away.trim().toLowerCase()) return "Local y visitante son el mismo club";
  if (r.hs == null || r.as == null) return "Falta el marcador";
  if ((r.ph == null) !== (r.pa == null)) return "Completa ambos marcadores de penales";
  if (r.stage === "final" && r.hs === r.as && r.ph == null) return "Una final empatada necesita penales";
  if (r.ph != null && r.ph === r.pa) return "Los penales no pueden terminar empatados";
  return "";
}

export async function saveMatches(comp: Comp, season: string, rows: Row[]) {
  for (const r of rows) {
    const s = r.season || season;
    await sb.from("seasons").upsert({ label: s, status: "finalizada" }, { onConflict: "label", ignoreDuplicates: true });
    const h = await ensureClub(r.home, comp.scope), a = await ensureClub(r.away, comp.scope);
    const { data: m, error } = await sb.from("matches").insert({
      competition: comp.slug, season: s, stage: r.stage, leg: r.leg, home_id: h.id, away_id: a.id,
      home_score: r.hs, away_score: r.as, pens_home: r.ph, pens_away: r.pa,
    }).select("id").single();
    if (error) throw error;
    if (comp.ranking) {
      const [ph, pa] = matchPoints(comp, r.stage, r.hs!, r.as!, Number(h.weight), Number(a.weight));
      await sb.from("ranking_points").insert([
        { ranking: comp.ranking, club_id: h.id, match_id: m.id, points: ph },
        { ranking: comp.ranking, club_id: a.id, match_id: m.id, points: pa },
      ]);
    }
    if (r.stage === "final") {
      const homeWins = r.hs! > r.as! || (r.hs === r.as && (r.ph ?? 0) > (r.pa ?? 0));
      await sb.from("titles").upsert({ competition: comp.slug, season: s, club_id: homeWins ? h.id : a.id }, { onConflict: "competition,season" });
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
