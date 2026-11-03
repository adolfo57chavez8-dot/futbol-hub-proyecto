"use client";
import { useRef, useState } from "react";
import { Comp, STAGE_LABEL } from "@/lib/competitions";
import { Row, normSeason, extract, saveMatches, validate } from "@/lib/data";

const num = (v: string) => (v === "" ? null : Number(v));
export default function MatchEditor({ comp, season, clubs, onSaved }: { comp: Comp; season: string; clubs: any[]; onSaved: () => void }) {
  const blank = (): Row => ({ season, stage: comp.stages[comp.stages.length - 1], leg: 1, home: "", away: "", hs: null, as: null, ph: null, pa: null });
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const names = clubs.filter((c) => comp.scope !== "IT" || c.country === "Italia").map((c) => c.name);
  const set = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function fromImage(f?: File) {
    if (!f) return;
    setBusy(true); setMsg("Leyendo imagen con IA…");
    try {
      const j = await extract(f, "matches");
      const list: Row[] = (j.matches || []).map((m: any) => ({
        season: normSeason(m.season) || season, stage: comp.stages.includes(m.stage) ? m.stage : comp.stages[comp.stages.length - 1], leg: 1,
        home: m.home || "", away: m.away || "", hs: m.home_score ?? null, as: m.away_score ?? null, ph: m.pens_home ?? null, pa: m.pens_away ?? null,
      }));
      setRows(list.length ? list : [blank()]);
      setMsg(`${list.length} partido(s) leídos. Revisa los datos, ajusta los penales si hubo y guarda.`);
    } catch (e: any) { setMsg(e.message); }
    setBusy(false); if (file.current) file.current.value = "";
  }
  async function save() {
    for (const r of rows) { const e = validate(comp, r); if (e) return setMsg(`${r.home || "Partido"}: ${e}`); }
    setBusy(true);
    try { await saveMatches(comp, season, rows); setRows([blank()]); setMsg("Partidos guardados"); onSaved(); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <div className="space-y-4">
      <datalist id="clubs-dl">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => setRows([...rows, blank()])}>Añadir partido</button>
        <button className="btn-ghost" onClick={() => file.current?.click()} disabled={busy}>Leer partidos desde imagen</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => fromImage(e.target.files?.[0])} />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="card p-3 grid gap-2 md:grid-cols-[150px_1fr_70px_70px_1fr_auto] items-end">
          <label className="text-sm">Fase
            <select className="inp" value={r.stage} onChange={(e) => set(i, { stage: e.target.value })}>
              {comp.stages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select></label>
          <label className="text-sm">Local<input className="inp" list="clubs-dl" value={r.home} onChange={(e) => set(i, { home: e.target.value })} /></label>
          <label className="text-sm">Goles<input className="inp" type="number" min={0} value={r.hs ?? ""} onChange={(e) => set(i, { hs: num(e.target.value) })} /></label>
          <label className="text-sm">Goles<input className="inp" type="number" min={0} value={r.as ?? ""} onChange={(e) => set(i, { as: num(e.target.value) })} /></label>
          <label className="text-sm">Visitante<input className="inp" list="clubs-dl" value={r.away} onChange={(e) => set(i, { away: e.target.value })} /></label>
          <button className="text-sm text-mute underline" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Quitar</button>
          <div className="md:col-span-6 flex flex-wrap gap-3 items-center text-sm">
            <label>Temporada <input className="inp !w-24" value={r.season} onChange={(e) => set(i, { season: e.target.value })} /></label>
            {comp.twoLegs.includes(r.stage) && (
              <label>Partido <select className="inp !w-auto" value={r.leg} onChange={(e) => set(i, { leg: Number(e.target.value) })}><option value={1}>Ida</option><option value={2}>Vuelta</option></select></label>
            )}
            <span>Penales (solo si hubo):</span>
            <input className="inp !w-16" type="number" min={0} aria-label="Penales local" value={r.ph ?? ""} onChange={(e) => set(i, { ph: num(e.target.value) })} />
            <span>–</span>
            <input className="inp !w-16" type="number" min={0} aria-label="Penales visitante" value={r.pa ?? ""} onChange={(e) => set(i, { pa: num(e.target.value) })} />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button className="btn" onClick={save} disabled={busy}>Guardar partidos</button>
        <span className="text-sm text-mute" role="status">{msg}</span>
      </div>
    </div>
  );
}
