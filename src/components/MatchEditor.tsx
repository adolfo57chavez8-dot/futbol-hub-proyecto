"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Comp, STAGE_LABEL } from "@/lib/competitions";
import { AliasMap, Row, createClub, existingMatchKeys, extract, loadAliases, matchClub, normSeason, saveMatches, validate } from "@/lib/data";

const num = (v: string) => (v === "" ? null : Number(v));
const toN = (v: any) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

type Review = Row & { ok: boolean; src: string; conf: string; note: string; hc: string | null; ac: string | null };

function ClubField({ label, name, id, country, pool, aliases, onName, onPick, onCreate, disabled }: {
  label: string; name: string; id: number | null; country?: string | null; pool: any[]; aliases: AliasMap; disabled: boolean;
  onName: (v: string) => void; onPick: (c: any) => void; onCreate: () => void;
}) {
  const auto = id ? { id, candidates: [] as any[] } : matchClub(name, pool, aliases, country);
  const resolved = id ?? auto.id;
  const found = resolved ? pool.find((c) => c.id === resolved) : null;
  const [q, setQ] = useState("");
  return (
    <div className="text-sm">
      <label>{label}<input className="inp" list="mx-clubs" value={name} onChange={(e) => onName(e.target.value)} /></label>
      {found && <p className="text-xs text-pitch mt-1">✓ {found.name}{found.country ? ` · ${found.country}` : ""}</p>}
      {!resolved && name.trim() && (
        <div className="mt-1 p-2 border border-gold rounded text-xs space-y-2" role="alert">
          <p>⚠ «{name.trim()}»{country ? ` (${country})` : ""} no existe en la base de datos.</p>
          {auto.candidates.length > 0 && (
            <p>¿Es uno de estos? {auto.candidates.map((c) => (
              <button key={c.id} className="underline mr-2" onClick={() => onPick(c)}>{c.name}{c.country ? ` (${c.country})` : ""}</button>))}</p>
          )}
          <input className="inp" list="mx-clubs" placeholder="Buscar un club existente…" value={q}
            onChange={(e) => { setQ(e.target.value); const c = pool.find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase()); if (c) { onPick(c); setQ(""); } }} />
          <button className="btn-ghost" disabled={disabled} onClick={onCreate}>Crear «{name.trim()}» como club nuevo</button>
        </div>
      )}
    </div>
  );
}

function RowFields({ r, comp, season, pool, aliases, busy, hc, ac, onChange, onCreate }: {
  r: Row; comp: Comp; season: string; pool: any[]; aliases: AliasMap; busy: boolean; hc?: string | null; ac?: string | null;
  onChange: (p: Partial<Row>) => void; onCreate: (side: "home" | "away") => void;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_70px_70px_1fr] items-start">
        <ClubField label="Local" name={r.home} id={r.homeId} country={hc} pool={pool} aliases={aliases} disabled={busy}
          onName={(v) => onChange({ home: v, homeId: null })} onPick={(c) => onChange({ home: c.name, homeId: c.id })} onCreate={() => onCreate("home")} />
        <label className="text-sm">Goles<input className="inp" type="number" min={0} value={r.hs ?? ""} onChange={(e) => onChange({ hs: num(e.target.value) })} /></label>
        <label className="text-sm">Goles<input className="inp" type="number" min={0} value={r.as ?? ""} onChange={(e) => onChange({ as: num(e.target.value) })} /></label>
        <ClubField label="Visitante" name={r.away} id={r.awayId} country={ac} pool={pool} aliases={aliases} disabled={busy}
          onName={(v) => onChange({ away: v, awayId: null })} onPick={(c) => onChange({ away: c.name, awayId: c.id })} onCreate={() => onCreate("away")} />
      </div>
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <label>Fase <select className="inp !w-auto" value={r.stage} onChange={(e) => onChange({ stage: e.target.value })}>
          {comp.stages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
        <label>Temporada <input className="inp !w-24" placeholder={season} value={r.season} onChange={(e) => onChange({ season: e.target.value })} /></label>
        {comp.twoLegs.includes(r.stage) && (
          <label>Partido <select className="inp !w-auto" value={r.leg} onChange={(e) => onChange({ leg: Number(e.target.value) })}><option value={1}>Ida</option><option value={2}>Vuelta</option></select></label>
        )}
        <span>Penales (si hubo):</span>
        <input className="inp !w-16" type="number" min={0} aria-label="Penales local" value={r.ph ?? ""} onChange={(e) => onChange({ ph: num(e.target.value) })} />
        <span>–</span>
        <input className="inp !w-16" type="number" min={0} aria-label="Penales visitante" value={r.pa ?? ""} onChange={(e) => onChange({ pa: num(e.target.value) })} />
      </div>
    </>
  );
}

export default function MatchEditor({ comp, season, clubs, onSaved }: { comp: Comp; season: string; clubs: any[]; onSaved: () => void }) {
  const pool = useMemo(() => clubs.filter((c) => comp.scope !== "IT" || c.country === "Italia"), [clubs, comp.scope]);
  const [aliases, setAliases] = useState<AliasMap>(new Map());
  useEffect(() => { loadAliases().then(setAliases); }, []);
  const [stage, setStage] = useState(comp.stages[comp.stages.length - 1]);
  const blank = (st = stage): Row => ({ season: "", stage: st, leg: 1, home: "", away: "", homeId: null, awayId: null, hs: null, as: null, ph: null, pa: null });
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [review, setReview] = useState<Review[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const set = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setRev = (i: number, p: Partial<Review>) => setReview((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const sideId = (n: string, id: number | null, country?: string | null) => id ?? matchClub(n, pool, aliases, country).id;

  // Clubes que no existen (en el formulario y en la revisión), con el país que detectó la IA.
  const missingMap = new Map<string, { name: string; country: string | null }>();
  const addMissing = (n: string, id: number | null, c?: string | null) => {
    if (n.trim() && !sideId(n, id, c)) missingMap.set(n.trim().toLowerCase(), { name: n.trim(), country: c ?? null });
  };
  rows.forEach((r) => { addMissing(r.home, r.homeId); addMissing(r.away, r.awayId); });
  review.forEach((r) => { addMissing(r.home, r.homeId, r.hc); addMissing(r.away, r.awayId, r.ac); });
  const missing = Array.from(missingMap.values());

  function changeStage(s: string) { setStage(s); setRows((rs) => rs.map((r) => ({ ...r, stage: s }))); }

  const resolve = <T extends Row>(r: T, hc?: string | null, ac?: string | null): T => ({
    ...r, season: r.season || season, homeId: sideId(r.home, r.homeId, hc), awayId: sideId(r.away, r.awayId, ac),
  });
  const rowError = (r: Review) => {
    const f = resolve(r, r.hc, r.ac);
    return validate(comp, f) || (f.homeId && f.awayId && existing.has(`${f.season}|${f.stage}|${f.leg}|${f.homeId}|${f.awayId}`) ? "dup" : "");
  };

  async function fromImages(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const list = Array.from(files);
    const out: Review[] = []; const failed: string[] = [];
    const ctx = { competition: comp.name, scope: comp.scope, stage: STAGE_LABEL[stage], clubs: clubs.map((c) => ({ name: c.name, country: c.country })) };
    for (let k = 0; k < list.length; k++) {
      const f = list[k];
      setMsg(`Leyendo imagen ${k + 1} de ${list.length} (${f.name})…`);
      if (k > 0) await sleep(2500); // respeta el límite de peticiones por minuto del nivel gratuito
      try {
        const j = await extract(f, "matches", ctx);
        for (const m of j.matches || []) out.push({
          ...blank(), season: normSeason(m.season), leg: m.leg === 2 ? 2 : 1,
          home: String(m.home || "").trim(), away: String(m.away || "").trim(),
          hs: toN(m.home_score), as: toN(m.away_score), ph: toN(m.pens_home), pa: toN(m.pens_away),
          ok: true, src: f.name, hc: m.home_country || null, ac: m.away_country || null,
          conf: ["alta", "media", "baja"].includes(m.confidence) ? m.confidence : "media", note: m.note ? String(m.note) : "",
        });
      } catch (e: any) { failed.push(`${f.name}: ${e.message}`); }
    }
    if (out.length) {
      const seasons = Array.from(new Set(out.map((r) => r.season || season)));
      try { setExisting(await existingMatchKeys(comp, seasons)); } catch { /* sin avisos de duplicados */ }
      setReview((rs) => [...rs, ...out]);
    }
    setMsg(
      (out.length ? `${out.length} partido(s) leídos: revísalos abajo y guarda los correctos.` : "No se leyó ningún partido.") +
      (failed.length ? ` Fallaron ${failed.length}: ${failed.join(" | ")}` : "")
    );
    setBusy(false); if (file.current) file.current.value = "";
  }

  async function createMissing() {
    setBusy(true);
    try {
      const ids = new Map<string, number>();
      for (const m of missing) ids.set(m.name.toLowerCase(), (await createClub(m.name, comp.scope, m.country)).id);
      const fill = <T extends Row>(r: T, hc?: string | null, ac?: string | null): T => ({
        ...r,
        homeId: r.homeId ?? (sideId(r.home, null, hc) ? null : ids.get(r.home.trim().toLowerCase()) ?? null),
        awayId: r.awayId ?? (sideId(r.away, null, ac) ? null : ids.get(r.away.trim().toLowerCase()) ?? null),
      });
      setRows((rs) => rs.map((r) => fill(r)));
      setReview((rs) => rs.map((r) => fill(r, r.hc, r.ac)));
      setMsg(`${ids.size} club(es) creados.`); onSaved();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }
  async function createOne(r: Row & { hc?: string | null; ac?: string | null }, side: "home" | "away", apply: (p: Partial<Row>) => void) {
    setBusy(true);
    try {
      const c = await createClub(r[side], comp.scope, side === "home" ? r.hc : r.ac);
      apply(side === "home" ? { homeId: c.id, home: c.name } : { awayId: c.id, away: c.name });
      setMsg(`Club «${c.name}» creado.`); onSaved();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  async function save() {
    const final: Row[] = rows.map((r) => resolve(r));
    for (let i = 0; i < final.length; i++) { const e = validate(comp, final[i]); if (e) return setMsg(`Partido ${i + 1}: ${e}`); }
    setBusy(true);
    try { await saveMatches(comp, season, final); setRows([blank()]); setMsg(`${final.length} partido(s) guardados`); onSaved(); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  async function saveReview() {
    const chosen = review.map((r, i) => ({ r, i })).filter(({ r }) => r.ok);
    if (!chosen.length) return setMsg("Marca al menos un partido para guardar.");
    const final = chosen.map(({ r }) => resolve(r, r.hc, r.ac));
    for (let k = 0; k < final.length; k++) {
      const e = validate(comp, final[k]);
      if (e) return setMsg(`Partido de «${chosen[k].r.home || "?"} vs ${chosen[k].r.away || "?"}»: ${e}`);
    }
    const dups = chosen.filter(({ r }) => rowError(r) === "dup").length;
    if (dups && !window.confirm(`${dups} partido(s) ya parecen estar guardados. ¿Guardarlos de todos modos (se duplicarán)?`)) return;
    setBusy(true);
    try {
      await saveMatches(comp, season, final);
      const done = new Set(chosen.map(({ i }) => i));
      setReview((rs) => rs.filter((_, i) => !done.has(i)));
      setMsg(`${final.length} partido(s) guardados.`); onSaved();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  const nOk = review.filter((r) => r.ok).length;
  const badge = (c: string) => c === "alta" ? "text-pitch" : c === "baja" ? "text-red-400" : "text-gold";

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

      {review.length > 0 && (
        <section className="card p-4 space-y-3 border border-gold" aria-label="Revisión de lo leído por la IA">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold">Revisar lo que leyó la IA ({review.length})</h3>
            <span className="text-sm text-mute">Corrige lo que haga falta, desmarca lo que no quieras y guarda.</span>
            <button className="underline text-sm ml-auto" onClick={() => setReview((rs) => rs.map((r) => ({ ...r, ok: !(nOk === rs.length) })))}>
              {nOk === review.length ? "Desmarcar todos" : "Marcar todos"}</button>
          </div>
          {review.map((r, i) => {
            const err = rowError(r);
            return (
              <div key={i} className={`card p-3 space-y-3 ${r.ok ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={r.ok} onChange={(e) => setRev(i, { ok: e.target.checked })} /> Guardar este</label>
                  <span className="text-mute">Imagen: {r.src}</span>
                  <span className={badge(r.conf)}>Confianza {r.conf}</span>
                  {r.note && <span className="text-mute">· {r.note}</span>}
                  <button className="text-mute underline ml-auto" onClick={() => setReview((rs) => rs.filter((_, j) => j !== i))}>Descartar</button>
                </div>
                <RowFields r={r} comp={comp} season={season} pool={pool} aliases={aliases} busy={busy} hc={r.hc} ac={r.ac}
                  onChange={(p) => setRev(i, p)} onCreate={(side) => createOne(r, side, (p) => setRev(i, p))} />
                {err === "dup" && <p className="text-xs text-gold">⚠ Este partido ya está guardado en {comp.name} {r.season || season}.</p>}
                {err && err !== "dup" && r.ok && <p className="text-xs text-red-400">✗ {err}</p>}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn" onClick={saveReview} disabled={busy || nOk === 0}>Guardar {nOk} seleccionado(s)</button>
            <button className="btn-ghost" onClick={() => { if (window.confirm("¿Descartar todo lo leído por la IA?")) setReview([]); }} disabled={busy}>Descartar todo</button>
          </div>
        </section>
      )}

      {rows.map((r, i) => (
        <div key={i} className="card p-3 space-y-3">
          <RowFields r={r} comp={comp} season={season} pool={pool} aliases={aliases} busy={busy}
            onChange={(p) => set(i, p)} onCreate={(side) => createOne(r, side, (p) => set(i, p))} />
          <div className="flex"><button className="text-mute underline ml-auto text-sm" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [blank()])}>Quitar</button></div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button className="btn" onClick={save} disabled={busy}>Guardar partidos</button>
        <span className="text-sm text-mute" role="status">{msg}</span>
      </div>
    </div>
  );
}
