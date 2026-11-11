import { NextResponse } from "next/server";

const BASE = "Eres un extractor de datos de fútbol. Lee la imagen y responde SOLO JSON válido, sin texto extra. Marcadores como enteros. ";
const PROMPTS: Record<string, string> = {
  matches: BASE +
    'Formato: {"matches":[{"season":"25/26 o null","leg":1,"home":"","away":"","home_score":0,"away_score":0,"pens_home":null,"pens_away":null}]}. ' +
    "Reglas: 1) Lee SOLO el texto; ignora escudos y logos. 2) Escribe los nombres de los clubes tal como aparecen, sin traducirlos ni abreviarlos. 3) Un objeto por partido, en el orden de la imagen; home es el club de la izquierda/local. " +
    '4) Marcador normal en home_score/away_score (si dice "1:0 pró." o "2:1 prórroga", usa 1 y 0 o 2 y 1). ' +
    '5) Si hay penales (por ejemplo "5:4 pen." o "(4-3 pen.)") ponlos en pens_home/pens_away. Si además se ve el marcador normal, inclúyelo también; si solo se ve el de penales, deja home_score y away_score en null. ' +
    '6) Si aparece ida y vuelta, devuelve un objeto por partido con leg 1 o 2. 7) Omite partidos sin resultado ("-:-"). 8) Si un dato no se ve con claridad usa null; nunca lo inventes.',
  champion: BASE + 'Formato: {"champions":[{"season":"25/26 o null","club":"campeón"}]}. Usa nombres de clubes tal como aparecen.',
  clubs: BASE + 'Formato: {"clubs":[{"name":"","country":"","confederation":"UEFA|CONMEBOL|CONCACAF|AFC|CAF|OFC"}]}.',
  ranking: BASE + 'Formato: {"ranking":[{"club":"","country":"código o país","confederation":"UEFA|CONMEBOL|CONCACAF|AFC|CAF|OFC","points":0}]}. En tablas con varias columnas toma SOLO la columna de puntos totales (Pts). Incluye todas las filas visibles.',
};

/* Modelos estables, en orden. Si el primero está saturado (503), agotó su cuota (429) o no existe (404), se prueba el siguiente.
   Puedes forzar uno con la variable de entorno GEMINI_MODEL. */
const MODELS = Array.from(new Set([process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"].filter(Boolean))) as string[];

export async function POST(req: Request) {
  try {
    const { image, mime, kind } = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor" }, { status: 500 });
    if (!PROMPTS[kind] || !image) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    let last = "";
    for (const model of MODELS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPTS[kind] }, { inline_data: { mime_type: mime, data: image } }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        try {
          const txt = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
          return NextResponse.json(JSON.parse(txt.replace(/```json|```/g, "")));
        } catch { last = "La IA devolvió un formato inválido"; continue; }
      }
      last = j?.error?.message || `Error ${r.status}`;
      if (![404, 429, 500, 503].includes(r.status)) break;
    }
    return NextResponse.json({ error: `Gemini no pudo leer la imagen (${last}). Intenta de nuevo en un minuto.` }, { status: 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error inesperado" }, { status: 500 });
  }
}
