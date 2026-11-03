"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { COMPS } from "@/lib/competitions";

const next = (l: string) => { const [a, b] = l.split("-").map(Number); return `${String((a + 1) % 100).padStart(2, "0")}-${String((b + 1) % 100).padStart(2, "0")}`; };
export default function Temporadas() {
  const [season, setSeason] = useState(""); const [done, setDone] = useState<string[]>([]); const [all, setAll] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data: s } = await sb.from("seasons").select("*").order("label", { ascending: false });
    setAll(s || []); const cur = (s || []).find((x: any) => x.status === "activa")?.label || ""; setSeason(cur);
    if (cur) { const { data } = await sb.from("tournament_status").select("competition").eq("season", cur).eq("finalized", true); setDone((data || []).map((d: any) => d.competition)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const fin = async (slugs: string[]) => { await sb.from("tournament_status").upsert(slugs.map((c) => ({ season, competition: c, finalized: true }))); load(); };
  async function start() {
    const n = next(season);
    await sb.from("seasons").update({ status: "finalizada" }).eq("label", season);
    await sb.from("seasons").upsert({ label: n, status: "activa" }); load();
  }
  const complete = COMPS.every((c) => done.includes(c.slug));
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Temporadas</h1>
      {season ? <>
        <p>Temporada activa: <strong>{season}</strong></p>
        <div className="card divide-y divide-line">{COMPS.map((c) => (
          <div key={c.slug} className="p-3 flex items-center gap-3"><span className="flex-1">{c.name}</span>
            {done.includes(c.slug) ? <span className="text-pitch font-semibold">Finalizado</span> : <button className="btn-ghost" onClick={() => fin([c.slug])}>Finalizar torneo</button>}</div>))}</div>
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={() => fin(COMPS.map((c) => c.slug))}>Finalizar todos los torneos</button>
          <button className="btn" disabled={!complete} onClick={start}>Guardar e iniciar temporada {next(season)}</button>
        </div>
        {!complete && <p className="text-sm text-mute">Finaliza todos los torneos para iniciar la siguiente temporada.</p>}
      </> : <p className="text-mute">No hay temporada activa. Ejecuta seed.sql.</p>}
      <p className="text-sm text-mute">Historial: {all.map((s) => s.label).join(" · ")}</p>
    </div>
  );
}
