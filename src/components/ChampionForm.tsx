"use client";
import { useRef, useState } from "react";
import { Comp } from "@/lib/competitions";
import { addChampion, extract } from "@/lib/data";

export default function ChampionForm({ comp, season, clubs, onSaved }: { comp: Comp; season: string; clubs: any[]; onSaved: () => void }) {
  const [club, setClub] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function save(name = club, s = season) {
    if (!name.trim()) return setMsg("Escribe el club campeón");
    setBusy(true);
    try { await addChampion(comp, s, name); setClub(""); setMsg(`Campeón ${s}: ${name}. Si ya tenía títulos, se sumó uno.`); onSaved(); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }
  async function fromImage(f?: File) {
    if (!f) return; setBusy(true); setMsg("Leyendo imagen con IA…");
    try {
      const j = await extract(f, "champion"); const c = (j.champions || [])[0];
      if (!c?.club) setMsg("No encontré un campeón en la imagen"); else { setClub(c.club); setMsg(`Detectado: ${c.club}. Pulsa Guardar campeón para confirmar.`); }
    } catch (e: any) { setMsg(e.message); }
    setBusy(false); if (file.current) file.current.value = "";
  }
  return (
    <div className="card p-4 max-w-xl space-y-3">
      <datalist id="ch-dl">{clubs.filter((c) => c.country === "Italia").map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <label className="text-sm block">Club campeón de la temporada {season}
        <input className="inp" list="ch-dl" value={club} onChange={(e) => setClub(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => save()} disabled={busy}>Guardar campeón</button>
        <button className="btn-ghost" onClick={() => file.current?.click()} disabled={busy}>Leer desde imagen</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => fromImage(e.target.files?.[0])} />
      </div>
      <p className="text-sm text-mute" role="status">{msg}</p>
    </div>
  );
}
