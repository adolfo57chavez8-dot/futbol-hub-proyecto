"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { getComp, STAGE_LABEL } from "@/lib/competitions";
import Logo from "./Logo";
import MatchEditor from "./MatchEditor";
import ChampionForm from "./ChampionForm";
import { seasonKey } from "@/lib/data";

function standings(all: any[]) {
  const ms = all.filter((m) => m.home_score != null && m.away_score != null);
  const t: Record<string, any> = {};
  const g = (n: string) => (t[n] ??= { n, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 });
  for (const m of ms) {
    const h = g(m.home.name), a = g(m.away.name);
    h.pj++; a.pj++; h.gf += m.home_score; h.gc += m.away_score; a.gf += m.away_score; a.gc += m.home_score;
    if (m.home_score > m.away_score) { h.pg++; h.pts += 3; a.pp++; }
    else if (m.home_score < m.away_score) { a.pg++; a.pts += 3; h.pp++; }
    else { h.pe++; a.pe++; h.pts++; a.pts++; }
  }
  return Object.values(t).sort((x: any, y: any) => y.pts - x.pts || y.gf - y.gc - (x.gf - x.gc) || y.gf - x.gf);
}

export default function CompetitionView({ slug }: { slug: string }) {
  const comp = getComp(slug)!;
  const tabs = comp.manualChampion ? ["Campeones", "Registrar"] : ["Campeones", "Finales", "Clasificación", "Partidos", "Registrar"];
  const [tab, setTab] = useState("Campeones");
  const [season, setSeason] = useState(""); const [seasons, setSeasons] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]); const [matches, setMatches] = useState<any[]>([]);
  const [finals, setFinals] = useState<any[]>([]); const [champs, setChamps] = useState<Record<string, string>>({});
  const [clubs, setClubs] = useState<any[]>([]); const [closed, setClosed] = useState(false);

  const load = useCallback(async () => {
    const [s, t, c] = await Promise.all([
      sb.from("seasons").select("*").order("label", { ascending: false }),
      sb.from("v_titles").select("*").eq("competition", slug).order("titles", { ascending: false }),
      sb.from("clubs").select("*").order("name"),
    ]);
    const [f, ch] = await Promise.all([
      sb.from("matches").select("*, home:clubs!home_id(name), away:clubs!away_id(name)").eq("competition", slug).eq("stage", "final").order("id"),
      sb.from("titles").select("season, club:clubs(name)").eq("competition", slug),
    ]);
    setFinals(f.data || []); setChamps(Object.fromEntries((ch.data || []).map((t: any) => [t.season, t.club?.name])));
    s.data = (s.data || []).sort((a: any, b: any) => seasonKey(b.label) - seasonKey(a.label));
    setSeasons(s.data || []); setTitles(t.data || []); setClubs(c.data || []);
    const cur = season || (s.data || []).find((x: any) => x.status === "activa")?.label || (s.data || [])[0]?.label || "";
    if (!season) setSeason(cur);
    if (cur) {
      const [m, st] = await Promise.all([
        sb.from("matches").select("*, home:clubs!home_id(name), away:clubs!away_id(name)").eq("competition", slug).eq("season", cur).order("id"),
        sb.from("tournament_status").select("finalized").eq("competition", slug).eq("season", cur).maybeSingle(),
      ]);
      setMatches(m.data || []); setClosed(!!st.data?.finalized);
    }
  }, [slug, season]);
  useEffect(() => { load(); }, [load]);

  async function remove(m: any) {
    await sb.from("matches").delete().eq("id", m.id);
    if (m.stage === "final") await sb.from("titles").delete().eq("competition", slug).eq("season", m.season);
    load();
  }
  const byStage = comp.stages.map((s) => [s, matches.filter((m) => m.stage === s)] as const).filter(([, l]) => l.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Logo folder="competiciones" slug={slug} size={64} />
        <div><h1 className="text-4xl font-bold">{comp.name}</h1><p className="text-mute">{comp.blurb}</p></div>
        <label className="ml-auto text-sm">Temporada
          <select className="inp" value={season} onChange={(e) => setSeason(e.target.value)}>
            {seasons.map((s) => <option key={s.label} value={s.label}>{s.label}{s.status === "activa" ? " (activa)" : ""}</option>)}
          </select></label>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-4 py-2 font-semibold ${tab === t ? "border-b-2 border-pitch text-pitch" : "text-mute"}`}>{t}</button>
        ))}
      </div>
      {closed && <p className="card p-3 text-sm border-gold">Este torneo está finalizado para la temporada {season}. No admite más partidos.</p>}

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
      {tab === "Clasificación" && (
        <div className="card overflow-x-auto"><table className="t">
          <thead><tr><th>N°</th><th>Club</th>{["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"].map((h) => <th key={h} className="n">{h}</th>)}</tr></thead>
          <tbody>{standings(matches).map((r: any, i) => (
            <tr key={r.n}><td>{i + 1}</td><td>{r.n}</td><td className="n">{r.pj}</td><td className="n">{r.pg}</td><td className="n">{r.pe}</td><td className="n">{r.pp}</td>
              <td className="n">{r.gf}</td><td className="n">{r.gc}</td><td className="n">{r.gf - r.gc}</td><td className="n font-semibold">{r.pts}</td></tr>))}
            {!matches.length && <tr><td colSpan={10} className="text-mute">Sin partidos en {season}.</td></tr>}</tbody>
        </table></div>
      )}
      {tab === "Partidos" && (
        <div className="space-y-5">
          {byStage.map(([s, list]) => (
            <section key={s}><h2 className="text-2xl font-semibold mb-2">{STAGE_LABEL[s]}</h2>
              <div className="card divide-y divide-line">{list.map((m: any) => (
                <div key={m.id} className="p-3 flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-right">{m.home.name}</span>
                  <span className="font-semibold tabular-nums">{m.home_score != null ? `${m.home_score}–${m.away_score}` : ""}{m.pens_home != null && ` (${m.pens_home}–${m.pens_away} pen.)`}</span>
                  <span className="flex-1">{m.away.name}</span>
                  {comp.twoLegs.includes(s) && <span className="text-xs text-mute">{m.leg === 1 ? "Ida" : "Vuelta"}</span>}
                  <button className="text-xs text-mute underline" onClick={() => remove(m)}>Eliminar</button>
                </div>))}</div></section>
          ))}
          {!byStage.length && <p className="text-mute">Sin partidos en {season}.</p>}
        </div>
      )}
      {tab === "Registrar" && !closed && (comp.manualChampion
        ? <ChampionForm comp={comp} season={season} clubs={clubs} onSaved={load} />
        : <MatchEditor comp={comp} season={season} clubs={clubs} onSaved={load} />)}
    </div>
  );
}
