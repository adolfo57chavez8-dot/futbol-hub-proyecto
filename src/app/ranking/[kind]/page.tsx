"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { sb } from "@/lib/supabase";
import { extract } from "@/lib/data";
import Logo from "@/components/Logo";

const CONFS = ["UEFA", "CONMEBOL", "CONCACAF", "AFC", "CAF", "OFC", "Otra"];
export default function RankingPage() {
  const { kind } = useParams<{ kind: string }>();
  const uefa = kind === "uefa";
  const [rows, setRows] = useState<any[]>([]); const [conf, setConf] = useState(""); const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const { data } = await sb.from(uefa ? "v_ranking_uefa" : "v_ranking_mundial").select("*").order("pos");
    setRows(data || []);
  }, [uefa]);
  useEffect(() => { load(); }, [load]);

  async function fromImage(f?: File) {
    if (!f) return; setMsg("Leyendo ranking con IA…");
    try {
      const j = await extract(f, "ranking"); let n = 0;
      for (const r of j.ranking || []) {
        const col = uefa ? "base_uefa" : "base_mundial";
        const { data: c } = await sb.from("clubs").select("id").ilike("name", r.club).maybeSingle();
        if (c) await sb.from("clubs").update({ [col]: r.points }).eq("id", c.id);
        else await sb.from("clubs").insert({ name: r.club, country: r.country || "", confederation: r.confederation || (uefa ? "UEFA" : "Otra"), [col]: r.points });
        n++;
      }
      setMsg(`${n} clubes actualizados`); load();
    } catch (e: any) { setMsg(e.message); }
    if (file.current) file.current.value = "";
  }
  const shown = rows.filter((r) => !conf || r.confederation === conf);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Logo folder="rankings" slug={kind} size={64} />
        <div><h1 className="text-4xl font-bold">{uefa ? "Ranking de clubes UEFA" : "Ranking mundial de clubes"}</h1>
          <p className="text-mute">{uefa ? "Puntos de Champions, Europa League, Conference League y Supercopa UEFA." : "Puntos base por confederación más partidos del Mundial de Clubes."}</p></div>
        <div className="ml-auto flex gap-2 items-end">
          {!uefa && <select className="inp" aria-label="Confederación" value={conf} onChange={(e) => setConf(e.target.value)}><option value="">Todas las confederaciones</option>{CONFS.map((c) => <option key={c}>{c}</option>)}</select>}
          <button className="btn-ghost whitespace-nowrap" onClick={() => file.current?.click()}>Cargar desde imagen</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => fromImage(e.target.files?.[0])} />
        </div>
      </div>
      <p className="text-sm text-mute" role="status">{msg}</p>
      <div className="card overflow-x-auto"><table className="t">
        <thead><tr><th>N°</th><th>Club</th>{uefa && <th>País</th>}<th>Confederación</th><th className="n">Puntos</th></tr></thead>
        <tbody>{shown.map((r, i) => <tr key={r.id}><td>{conf ? i + 1 : r.pos}</td><td>{r.name}</td>{uefa && <td>{r.country}</td>}<td>{r.confederation}</td><td className="n font-semibold">{r.pts}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
