import "./globals.css";
import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import Link from "next/link";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });
export const metadata: Metadata = { title: "Futbol Hub", description: "Campeones, partidos y rankings de Italia, UEFA y Mundial de Clubes" };

const links = [["/", "Inicio"], ["/ranking/uefa", "Ranking UEFA"], ["/ranking/mundial", "Ranking mundial"], ["/clubes", "Clubes"], ["/temporadas", "Temporadas"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="bg-ink text-white">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="font-display text-2xl font-bold tracking-wide">Futbol Hub</Link>
            {links.slice(1).map(([h, l]) => <Link key={h} href={h} className="text-sm text-white/80 hover:text-white">{l}</Link>)}
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
