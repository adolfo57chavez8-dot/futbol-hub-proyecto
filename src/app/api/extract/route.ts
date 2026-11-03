import { NextResponse } from "next/server";

const BASE = "Eres un extractor de datos de fútbol. Lee la imagen y responde SOLO JSON válido, sin texto extra. Usa nombres de clubes en español cuando existan (Inter, Milan, Bayern Múnich). Marcadores como enteros. ";
const PROMPTS: Record<string, string> = {
  matches: BASE + 'Formato: {"matches":[{"season":"25/26 o null","stage":"fase-liga|playoff|dieciseisavos|octavos|cuartos|semifinal|tercer-puesto|preliminar|final|null","home":"club local","away":"club visitante","home_score":0,"away_score":0,"pens_home":null,"pens_away":null}]}. Si el resultado trae "5:4 pen." o similar, ponlo en pens_home/pens_away y deja en home_score/away_score el marcador de juego.',
  champion: BASE + 'Formato: {"champions":[{"season":"25/26 o null","club":"campeón"}]}.',
  clubs: BASE + 'Formato: {"clubs":[{"name":"","country":"","confederation":"UEFA|CONMEBOL|CONCACAF|AFC|CAF|OFC"}]}.',
  ranking: BASE + 'Formato: {"ranking":[{"club":"","country":"código o país","confederation":"UEFA|CONMEBOL|CONCACAF|AFC|CAF|OFC","points":0}]}. En tablas con varias columnas toma SOLO la columna de puntos totales (Pts). Incluye todas las filas visibles.',
};

export async function POST(req: Request) {
  try {
    const { image, mime, kind } = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor" }, { status: 500 });
    if (!PROMPTS[kind] || !image) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPTS[kind] }, { inline_data: { mime_type: mime, data: image } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    const j = await r.json();
    if (!r.ok) return NextResponse.json({ error: j?.error?.message || "Gemini rechazó la solicitud" }, { status: 502 });
    const txt = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return NextResponse.json(JSON.parse(txt.replace(/```json|```/g, "")));
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error inesperado" }, { status: 500 });
  }
}
