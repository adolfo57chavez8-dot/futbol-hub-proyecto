"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { extract } from "@/lib/data";

const CONFS = ["UEFA", "CONMEBOL", "CONCACAF", "AFC", "CAF", "OFC"];
export default function Clubes() {
  const [clubs, setClubs] = useState<any[]>([]); const [q, setQ] = useState("");
  const [f, setF] = useState({ name: "", country: "", confederation: "UEFA", weight: "1" }); const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const { data } = await sb.from("clubs").select("*").order("name"); setClubs(data || []); }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!f.name.trim()) return setMsg("Escribe el nombre del club");
    const { error } = await sb.from("clubs").insert({ ...f, name: f.name.trim(), weight: Number(f.weight) || 1 });
    setMsg(error ? (error.code === "23505" ? "Ese club ya existe" : error.message) : "Club agregado");
    if (!error) { setF({ ...f, name: "" }); load(); }
  }
  async function fromImage(file?: File) {
    if (!file) return; setMsg("Leyendo clubes con IA…");
    try {
      const j = await extract(file, "clubs");
      const list = (j.clubs || []).map((c: any) => ({ name: c.name, country: c.country || "", confederation: c.confederation || "UEFA" }));
      const { error } = await sb.from("clubs").upsert(list, { onConflict: "name", ignoreDuplicates: true });
      setMsg(error ? error.message : `${list.length} clubes procesados`); load();
    } catch (e: any) { setMsg(e.message); }
  }
  async function setWeight(id: number, w: string) { await sb.from("clubs").update({ weight: Number(w) || 1 }).eq("id", id); }
  const shown = clubs.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Clubes</h1>
      <div className="card p-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_100px_auto] items-end">
        <label className="text-sm">Club<input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="text-sm">País<input className="inp" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></label>
        <label className="text-sm">Confederación<select className="inp" value={f.confederation} onChange={(e) => setF({ ...f, confederation: e.target.value })}>{CONFS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-sm">Peso<input className="inp" type="number" step="0.1" min="0.5" max="2" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>
        <div className="flex gap-2"><button className="btn" onClick={add}>Agregar club</button>
          <button className="btn-ghost" onClick={() => file.current?.click()}>Desde imagen</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => fromImage(e.target.files?.[0])} /></div>
      </div>
      <p className="text-sm text-mute" role="status">{msg}</p>
      <input className="inp max-w-sm" placeholder="Buscar club" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto"><table className="t">
        <thead><tr><th>Club</th><th>País</th><th>Confederación</th><th className="n">Peso (0.5–2)</th></tr></thead>
        <tbody>{shown.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.country}</td><td>{c.confederation}</td>
          <td className="n"><input className="inp !w-20 text-right" type="number" step="0.1" defaultValue={c.weight} onBlur={(e) => setWeight(c.id, e.target.value)} aria-label={`Peso de ${c.name}`} /></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
