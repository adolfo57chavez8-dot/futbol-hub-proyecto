"use client";
import { useMemo, useRef, useState } from "react";
import { Comp, STAGE_LABEL } from "@/lib/competitions";
import { Row, createClub, extract, matchClub, normSeason, saveMatches, validate } from "@/lib/data";

const num = (v: string) => (v === "" ? null : Number(v));
const toN = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

function ClubField({ label, name, id, pool, onName, onPick, onCreate, disabled }: {
  label: string; name: string; id: number | null; pool: any[]; disabled: boolean;
  onName: (v: string) => void; onPick: (c: any) => void; onCreate: () => void;
}) {
  const auto = id ? { id, candidates: [] as any[] } : matchClub(name, pool);
  const resolved = id ?? auto.id;
  const found = resolved ? pool.find((c) => c.id === resolved) : null;
  const [q, setQ] = useState("");
  return (
    <div className="text-sm">
      <label>{label}<input className="inp" list="mx-clubs" value={name} onChange={(e) => onName(e.target.value)} /></label>
      {found && <p className="text-xs text-pitch mt-1">✓ {found.name}</p>}
      {!resolved && name.trim() && (
        <div className="mt-1 p-2 border border-gold rounded text-xs space-y-2" role="alert">
          <p>⚠ «{name.trim()}» no existe en la base de datos.</p>
          {auto.candidates.length > 0 && (
            <p>¿Es uno de estos? {auto.candidates.map((c) => (
              <button key={c.id} className="underline mr-2" onClick={() => onPick(c)}>{c.name}</button>))}</p>
          )}
          <input className="inp" list="mx-clubs" placeholder="Buscar un club existente…" value={q}
            onChange={(e) => { setQ(e.target.value); const c = pool.find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase()); if (c) { onPick(c); setQ(""); } }} />
          <button className="btn-ghost" disabled={disabled} onClick={onCreate}>Crear «{name.trim()}» como club nuevo</button>
        </div>
      )}
    </div>
  );
}

export default function MatchEditor({ comp, season, clubs, onSaved }: { comp: Comp; season: string; clubs: any[]; onSaved: () => void }) {
  const pool = useMemo(() => clubs.filter((c) => comp.scope !== "IT" || c.country === "Italia"), [clubs, comp.scope]);
  const [stage, setStage] = useState(comp.stages[comp.stages.length - 1]);
  const blank = (st = stage): Row => ({ season: "", stage: st, leg: 1, home: "", away: "", homeId: null, awayId: null, hs: null, as: null, ph: null, pa: null });
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const sideId = (n: string, id: number | null) => id ?? matchClub(n, pool).id;
  const missing = Array.from(new Map(rows.flatMap((r) => [[r.home, r.homeId], [r.away, r.awayId]] as [string, number | null][])
    .filter(([n, id]) => n.trim() && !sideId(n, id)).map(([n]) => [n.trim().toLowerCase(), n.trim()])).values());

  function changeStage(s: string) { setStage(s); setRows((rs) => rs.map((r) => ({ ...r, stage: s }))); }

  async function fromImages(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: Row[] = [];
    for (const f of Array.from(files)) {
      setMsg(`Leyendo ${f.name}…`);
      try {
        const j = await extract(f, "matches");
        for (const m of j.matches || []) out.push({
          ...blank(), season: normSeason(m.season), leg: m.leg === 2 ? 2 : 1,
          home: String(m.home || ""), away: String(m.away || ""),
          hs: toN(m.home_score), as: toN(m.away_score), ph: toN(m.pens_home), pa: toN(m.pens_away),
        });
      } catch (e: any) { setMsg(e.message); setBusy(false); return; }
    }
    const keep = rows.filter((r) => r.home || r.away || r.hs != null);
    setRows(keep.length + out.length ? [...keep, ...out] : [blank()]);
    const nf = new Set(out.flatMap((r) => [r.home, r.away]).filter((n) => n && !matchClub(n, pool).id).map((n) => n.toLowerCase())).size;
    setMsg(`${out.length} partido(s) leídos.` + (nf ? ` ${nf} club(es) no existen: elige uno existente o créalo.` : " Revisa los datos y guarda."));
    setBusy(false); if (file.current) file.current.value = "";
  }

  async function createMissing() {
    setBusy(true);
    try {
      const ids = new Map<string, number>();
      for (const n of missing) ids.set(n.toLowerCase(), (await createClub(n, comp.scope)).id);
      setRows((rs) => rs.map((r) => ({
        ...r,
        homeId: r.homeId ?? (sideId(r.home, null) ? null : ids.get(r.home.trim().toLowerCase()) ?? null),
        awayId: r.awayId ?? (sideId(r.away, null) ? null : ids.get(r.away.trim().toLowerCase()) ?? null),
      })));
      setMsg(`${ids.size} club(es) creados.`); onSaved();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }
  async function createOne(i: number, side: "home" | "away") {
    setBusy(true);
    try {
      const c = await createClub(rows[i][side], comp.scope);
      set(i, side === "home" ? { homeId: c.id, home: c.name } : { awayId: c.id, away: c.name });
      setMsg(`Club «${c.name}» creado.`); onSaved();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  async function save() {
    const final: Row[] = rows.map((r) => ({ ...r, season: r.season || season, homeId: sideId(r.home, r.homeId), awayId: sideId(r.away, r.awayId) }));
    for (let i = 0; i < final.length; i++) { const e = validate(comp, final[i]); if (e) return setMsg(`Partido ${i + 1}: ${e}`); }
    setBusy(true);
    try { await saveMatches(comp, season, final); setRows([blank()]); setMsg(`${final.length} partido(s) guardados`); onSaved(); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <datalist id="mx-clubs">{pool.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">Fase de estos partidos
          <select className="inp" value={stage} onChange={(e) => changeStage(e.target.value)}>
            {comp.stages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select></label>
        <button className="btn-ghost" onClick={() => setRows([...rows, blank()])}>Añadir partido</button>
        <button className="btn-ghost" onClick={() => file.current?.click()} disabled={busy}>Leer partidos desde imágenes</button>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => fromImages(e.target.files)} />
        {missing.length > 0 && <button className="btn-ghost" onClick={createMissing} disabled={busy}>Crear los {missing.length} clubes que no existen</button>}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="card p-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_70px_70px_1fr] items-start">
            <ClubField label="Local" name={r.home} id={r.homeId} pool={pool} disabled={busy}
              onName={(v) => set(i, { home: v, homeId: null })} onPick={(c) => set(i, { home: c.name, homeId: c.id })} onCreate={() => createOne(i, "home")} />
            <label className="text-sm">Goles<input className="inp" type="number" min={0} value={r.hs ?? ""} onChange={(e) => set(i, { hs: num(e.target.value) })} /></label>
            <label className="text-sm">Goles<input className="inp" type="number" min={0} value={r.as ?? ""} onChange={(e) => set(i, { as: num(e.target.value) })} /></label>
            <ClubField label="Visitante" name={r.away} id={r.awayId} pool={pool} disabled={busy}
              onName={(v) => set(i, { away: v, awayId: null })} onPick={(c) => set(i, { away: c.name, awayId: c.id })} onCreate={() => createOne(i, "away")} />
          </div>
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label>Fase <select className="inp !w-auto" value={r.stage} onChange={(e) => set(i, { stage: e.target.value })}>
              {comp.stages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
            <label>Temporada <input className="inp !w-24" placeholder={season} value={r.season} onChange={(e) => set(i, { season: e.target.value })} /></label>
            {comp.twoLegs.includes(r.stage) && (
              <label>Partido <select className="inp !w-auto" value={r.leg} onChange={(e) => set(i, { leg: Number(e.target.value) })}><option value={1}>Ida</option><option value={2}>Vuelta</option></select></label>
            )}
            <span>Penales (si hubo):</span>
            <input className="inp !w-16" type="number" min={0} aria-label="Penales local" value={r.ph ?? ""} onChange={(e) => set(i, { ph: num(e.target.value) })} />
            <span>–</span>
            <input className="inp !w-16" type="number" min={0} aria-label="Penales visitante" value={r.pa ?? ""} onChange={(e) => set(i, { pa: num(e.target.value) })} />
            <button className="text-mute underline ml-auto" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [blank()])}>Quitar</button>
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
