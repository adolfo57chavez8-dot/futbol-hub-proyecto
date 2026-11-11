"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { getComp, STAGE_LABEL } from "@/lib/competitions";
import { seasonKey } from "@/lib/data";
import Logo from "./Logo";
import MatchEditor from "./MatchEditor";
import ChampionForm from "./ChampionForm";

const ALL = "ALL";
const PAGE = 1000;
/** Supabase devuelve máximo 1000 filas por consulta: se pide por páginas. */
async function paged(q: (a: number, b: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let a = 0; ; a += PAGE) {
    const { data } = await q(a, a + PAGE - 1);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}
const MATCH_SEL = "*, home:clubs!home_id(name), away:clubs!away_id(name)";

function buildRank(rows: any[], mode: string, season: string) {
  const src = mode === "temporada" ? rows.filter((r) => r.season === season) : rows;
  const m = new Map<number, any>();
  for (const r of src) {
    const x = m.get(r.club_id) ?? { n: r.name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, temp: 0 };
    x.pj += r.pj; x.pg += r.pg; x.pe += r.pe; x.pp += r.pp; x.gf += r.gf; x.gc += r.gc; x.pts += r.pts; x.temp++;
    m.set(r.club_id, x);
  }
  return Array.from(m.values()).sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.n.localeCompare(b.n));
}

export default function CompetitionView({ slug }: { slug: string }) {
  const comp = getComp(slug)!;
  const tabs = comp.manualChampion ? ["Campeones", "Registrar"] : ["Campeones", "Finales", "Ranking", "Partidos", "Registrar"];
  const [tab, setTab] = useState("Campeones");
  const [season, setSeason] = useState(""); const [seasons, setSeasons] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]); const [matches, setMatches] = useState<any[]>([]);
  const [finals, setFinals] = useState<any[]>([]); const [champs, setChamps] = useState<Record<string, string>>({});
  const [stand, setStand] = useState<any[]>([]);
  const [mode, setMode] = useState<"temporada" | "acumulado">(comp.scope === "IT" ? "acumulado" : "temporada");
  const [clubs, setClubs] = useState<any[]>([]); const [closed, setClosed] = useState(false);
  const active = seasons.find((s) => s.status === "activa")?.label || seasons[0]?.label || "";

  const load = useCallback(async () => {
    const [s, t, c, f, ch, st] = await Promise.all([
      sb.from("seasons").select("*"),
      sb.from("v_titles").select("*").eq("competition", slug).order("titles", { ascending: false }),
      paged((a, b) => sb.from("clubs").select("*").order("name").range(a, b)),
      sb.from("matches").select(MATCH_SEL).eq("competition", slug).eq("stage", "final").order("id"),
      sb.from("titles").select("season, club:clubs(name)").eq("competition", slug),
      paged((a, b) => sb.from("v_standings").select("*").eq("competition", slug).range(a, b)),
    ]);
    const ss = (s.data || []).sort((x: any, y: any) => seasonKey(y.label) - seasonKey(x.label));
    const act = ss.find((x: any) => x.status === "activa")?.label || ss[0]?.label || "";
    setSeasons(ss); setTitles(t.data || []); setClubs(c); setFinals(f.data || []); setStand(st);
    setChamps(Object.fromEntries((ch.data || []).map((x: any) => [x.season, x.club?.name])));
    const cur = season || act;
    if (!season) setSeason(cur);
    const target = cur === ALL ? act : cur;
    if (cur === ALL) setMatches(await paged((a, b) => sb.from("matches").select(MATCH_SEL).eq("competition", slug).order("id").range(a, b)));
    else if (cur) setMatches(await paged((a, b) => sb.from("matches").select(MATCH_SEL).eq("competition", slug).eq("season", cur).order("id").range(a, b)));
    if (target) {
      const { data } = await sb.from("tournament_status").select("finalized").eq("competition", slug).eq("season", target).maybeSingle();
      setClosed(!!data?.finalized);
    }
  }, [slug, season]);
  useEffect(() => { load(); }, [load]);

  async function remove(m: any) {
    await sb.from("matches").delete().eq("id", m.id);
    if (m.stage === "final") await sb.from("titles").delete().eq("competition", slug).eq("season", m.season);
    load();
  }

  const counts: Record<string, number> = {};
  stand.forEach((r) => { counts[r.season] = (counts[r.season] || 0) + r.pj / 2; });
  const withMatches = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => seasonKey(b[0]) - seasonKey(a[0]));
  const effMode = season === ALL ? "acumulado" : mode;
  const rank = buildRank(stand, effMode, season);
  const regSeason = season === ALL ? active : season;
  const groups = season === ALL ? Array.from(new Set(matches.map((m) => m.season))).sort((a: any, b: any) => seasonKey(b) - seasonKey(a)) : [season];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Logo folder="competiciones" slug={slug} size={64} />
        <div><h1 className="text-4xl font-bold">{comp.name}</h1><p className="text-mute">{comp.blurb}</p></div>
        <label className="ml-auto text-sm">Temporada
          <select className="inp" value={season} onChange={(e) => setSeason(e.target.value)}>
            <option value={ALL}>Todas las temporadas</option>
            {seasons.map((s) => <option key={s.label} value={s.label}>{s.label}{s.status === "activa" ? " (activa)" : ""}</option>)}
          </select></label>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-line overflow-x-auto">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-2 font-semibold whitespace-nowrap ${tab === t ? "border-b-2 border-pitch text-pitch" : "text-mute"}`}>{t}</button>
        ))}
      </div>
      {closed && tab === "Registrar" && <p className="card p-3 text-sm border-gold">Este torneo está finalizado para la temporada {regSeason}. No admite más partidos.</p>}

      {tab === "Campeones" && (
        <div className="card overflow-x-auto"><table className="t">
          <thead><tr><th>N°</th><th>Club</th><th className="n">Títulos</th></tr></thead>
          <tbody>{titles.map((t, i) => <tr key={t.club_id}><td>{i + 1}</td><td>{t.name}</td><td className="n font-semibold">{t.titles}</td></tr>)}
            {!titles.length && <tr><td colSpan={3} className="text-mute">Aún no hay campeones. Registra una final o ejecuta seed.sql.</td></tr>}</tbody>
        </table></div>
      )}

      {tab === "Finales" && (
        <div className="card overflow-x-auto"><table className="t">
          <thead><tr><th>Temporada</th><th>Local</th><th className="n">Resultado</th><th>Visitante</th><th>Campeón</th></tr></thead>
          <tbody>{Object.entries(finals.reduce((g: any, m: any) => ((g[m.season] ||= []).push(m), g), {}))
            .sort((a, b) => seasonKey(b[0]) - seasonKey(a[0])).map(([se, ms]: any) => (
            <tr key={se}><td>{se}</td><td>{ms[0].home.name}</td>
              <td className="n">{ms.map((m: any) => `${m.home_score ?? "–"}:${m.away_score ?? "–"}${m.pens_home != null ? ` (${m.pens_home}-${m.pens_away} pen.)` : ""}`).join("  |  ")}</td>
              <td>{ms[0].away.name}</td><td className="font-semibold">{champs[se] ?? ""}</td></tr>))}
            {!finals.length && <tr><td colSpan={5} className="text-mute">Aún no hay finales registradas.</td></tr>}</tbody>
        </table></div>
      )}

      {tab === "Ranking" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {season !== ALL && (["temporada", "acumulado"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={m === mode ? "btn" : "btn-ghost"}>{m === "temporada" ? `Temporada ${season}` : "Acumulado histórico"}</button>
            ))}
            {effMode === "acumulado" && <p className="text-sm text-mute">Los puntos de cada temporada se siguen sumando; un club entra al ranking en cuanto juega su primer partido.</p>}
          </div>
          <div className="card overflow-x-auto"><table className="t">
            <thead><tr><th>N°</th><th>Club</th>{["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"].map((h) => <th key={h} className="n">{h}</th>)}{effMode === "acumulado" && <th className="n">Temp.</th>}</tr></thead>
            <tbody>{rank.map((r: any, i) => (
              <tr key={r.n}><td>{i + 1}</td><td>{r.n}</td><td className="n">{r.pj}</td><td className="n">{r.pg}</td><td className="n">{r.pe}</td><td className="n">{r.pp}</td>
                <td className="n">{r.gf}</td><td className="n">{r.gc}</td><td className="n">{r.gf - r.gc}</td><td className="n font-semibold">{r.pts}</td>{effMode === "acumulado" && <td className="n">{r.temp}</td>}</tr>))}
              {!rank.length && <tr><td colSpan={11} className="text-mute">Sin partidos registrados{effMode === "temporada" ? ` en ${season}` : ""}.</td></tr>}</tbody>
          </table></div>
        </div>
      )}

      {tab === "Partidos" && (
        <div className="space-y-5">
          {groups.map((g: string) => {
            const bs = comp.stages.map((s) => [s, matches.filter((m) => m.season === g && m.stage === s)] as const).filter(([, l]) => l.length);
            return bs.length ? (
              <div key={g} className="space-y-4">
                {season === ALL && <h2 className="text-3xl font-bold">Temporada {g}</h2>}
                {bs.map(([s, list]) => (
                  <section key={s}><h2 className="text-2xl font-semibold mb-2">{STAGE_LABEL[s]}</h2>
                    <div className="card divide-y divide-line">{list.map((m: any) => (
                      <div key={m.id} className="p-3 flex flex-wrap items-center gap-3">
                        <span className="flex-1 text-right">{m.home.name}</span>
                        <span className="font-semibold tabular-nums">{m.home_score ?? "–"}–{m.away_score ?? "–"}{m.pens_home != null && ` (${m.pens_home}–${m.pens_away} pen.)`}</span>
                        <span className="flex-1">{m.away.name}</span>
                        {comp.twoLegs.includes(s) && <span className="text-xs text-mute">{m.leg === 1 ? "Ida" : "Vuelta"}</span>}
                        <button className="text-xs text-mute underline" onClick={() => remove(m)}>Eliminar</button>
                      </div>))}</div></section>
                ))}
              </div>
            ) : null;
          })}
          {!matches.length && (
            <div className="card p-4 space-y-2">
              <p className="text-mute">Sin partidos en {season}.</p>
              {withMatches.length > 0 && (
                <p className="text-sm">Hay partidos en otras temporadas: {withMatches.slice(0, 6).map(([s, n]) => (
                  <button key={s} className="underline mr-3" onClick={() => setSeason(s)}>{s} ({n})</button>))}
                  <button className="underline" onClick={() => setSeason(ALL)}>ver todas</button></p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "Registrar" && !closed && (comp.manualChampion
        ? <ChampionForm comp={comp} season={regSeason} clubs={clubs} onSaved={load} />
        : <MatchEditor comp={comp} season={regSeason} clubs={clubs} onSaved={load} />)}
    </div>
  );
}
