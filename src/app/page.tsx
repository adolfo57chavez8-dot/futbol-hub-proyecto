import Link from "next/link";
import { COMPS } from "@/lib/competitions";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-4xl font-bold">Competiciones</h1>
        <p className="text-mute mt-1">Registra partidos a mano o desde una imagen; los campeones y rankings se actualizan solos.</p>
      </section>
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMPS.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="card p-4 flex gap-4 items-center hover:border-pitch">
            <Logo folder="competiciones" slug={c.slug} />
            <div><h2 className="text-xl font-semibold">{c.name}</h2><p className="text-sm text-mute">{c.blurb}</p></div>
          </Link>
        ))}
      </section>
      <section className="grid sm:grid-cols-2 gap-4">
        {[["uefa", "Ranking de clubes UEFA", "Suma las cuatro competiciones UEFA"], ["mundial", "Ranking mundial de clubes", "Por confederación, con Mundial de Clubes"]].map(([k, t, d]) => (
          <Link key={k} href={`/ranking/${k}`} className="card p-4 flex gap-4 items-center hover:border-gold">
            <Logo folder="rankings" slug={k} />
            <div><h2 className="text-xl font-semibold">{t}</h2><p className="text-sm text-mute">{d}</p></div>
          </Link>
        ))}
      </section>
    </div>
  );
}
