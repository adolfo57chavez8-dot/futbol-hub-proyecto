import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Modelos de Gemini en orden de preferencia (nombres de tu panel de AI Studio).
 * Si el primero está saturado (503), sin cuota (429) o no existe (404), pasa al siguiente:
 * cada modelo tiene su propia cuota por minuto, así que la lectura de varias imágenes aguanta más.
 * Puedes forzar uno con la variable GEMINI_MODEL en Vercel.
 */
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"].filter(
  (m, i, a): m is string => !!m && a.indexOf(m) === i
);

const BASE =
  "Eres un extractor de datos de fútbol. Lee la imagen y responde SOLO JSON válido, sin texto extra ni markdown. Marcadores como enteros. ";

const MATCH_RULES =
  "REGLAS DE LECTURA: " +
  "1) Un objeto por partido, en el orden de la imagen; home es el club de la izquierda o el local. " +
  "2) Los nombres salen del TEXTO de la imagen. El escudo es solo una pista para distinguir clubes homónimos (Inter vs Inter Miami, Milan vs Milán de otro país, Real Madrid vs Real Betis, Sporting de Lisboa vs Sporting Gijón, Olympique de Marsella vs Olympique de Lyon…). No describas ni devuelvas escudos. " +
  "3) Si el club coincide con uno de la LISTA CONOCIDA, devuelve exactamente el nombre de la lista (por ejemplo «Internazionale», «Inter Milan» o «FC Internazionale» → «Inter»; «AC Milan» → «Milan»; «Bayern Munich» → «Bayern Múnich»). Si no está en la lista, devuelve el nombre tal como aparece, sin inventar ni traducir de forma rara. " +
  "4) home_country y away_country: país del club en español (Italia, España, Inglaterra, Alemania, Francia, Brasil, Argentina…) cuando lo sepas con seguridad; si no, null. Usa el nombre, el escudo y la competición para decidirlo. " +
  "5) Marcador normal en home_score/away_score. Si el partido fue a prórroga (por ejemplo «1:0 n.V.», «2:1 pró.», «a.e.t.»), usa el marcador final tras la prórroga. " +
  "6) Penales: ponlos en pens_home/pens_away (por ejemplo «5:4 pen.», «i.E.», «(4-3 pen.)», «4-3 on pens»). Si además se ve el marcador normal, inclúyelo también; si solo se ve el de penales, deja home_score y away_score en null. " +
  "7) IGNORA el marcador global/agregado de una eliminatoria de ida y vuelta y el marcador del descanso (el que va entre paréntesis pequeños). Solo cuenta el resultado de cada partido. " +
  "8) Si aparece ida y vuelta, un objeto por partido con leg 1 o 2; si es partido único, leg 1. " +
  "9) Omite partidos sin resultado («-:-», «vs», fecha futura). " +
  "10) Si un dato no se ve con claridad usa null y pon confidence «baja» con una note breve; nunca lo inventes. Si todo es claro, confidence «alta». ";

const PROMPTS: Record<string, string> = {
  champion: BASE + 'Formato: {"champions":[{"season":"25/26 o null","club":"campeón"}]}. Usa nombres de clubes tal como aparecen.',
  clubs: BASE + 'Formato: {"clubs":[{"name":"","country":"","confederation":"UEFA|CONMEBOL|CONCACAF|AFC|CAF|OFC"}]}.',
  ranking:
    BASE +
    'Formato: {"ranking":[{"club":"","country":"código o país","confederation":"UEFA|CONMEBOL|CONCACAF|AFC|CAF|OFC","points":0}]}. En tablas con varias columnas toma SOLO la columna de puntos totales (Pts). Incluye todas las filas visibles.',
};

type Ctx = { competition?: string; scope?: string; stage?: string; clubs?: { name: string; country?: string }[] };

function matchesPrompt(ctx: Ctx) {
  const where =
    ctx.scope === "IT"
      ? "Es una competición italiana: casi todos los clubes son de Italia (Serie A, Serie B, Serie C…), pero comprueba el escudo y el nombre."
      : ctx.scope === "UEFA"
      ? "Es una competición europea de clubes: los clubes vienen de distintos países de Europa; distingue bien a cada uno."
      : ctx.scope === "MUNDIAL"
      ? "Es un Mundial de Clubes: hay clubes de todas las confederaciones (UEFA, CONMEBOL, CONCACAF, AFC, CAF, OFC); distingue bien a cada uno."
      : "";
  const list = (ctx.clubs || [])
    .slice(0, 600)
    .map((c) => (c.country ? `${c.name} (${c.country})` : c.name))
    .join("; ");
  return (
    BASE +
    `Competición: ${ctx.competition || "desconocida"}. ${ctx.stage ? `Fase: ${ctx.stage}. ` : ""}${where} ` +
    'Formato: {"matches":[{"season":"25/26 o null","leg":1,"home":"","away":"","home_country":null,"away_country":null,"home_score":0,"away_score":0,"pens_home":null,"pens_away":null,"confidence":"alta|media|baja","note":null}]}. ' +
    MATCH_RULES +
    (list ? `LISTA CONOCIDA: ${list}.` : "")
  );
}

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function parseJson(parts: any[]) {
  // Ignora las partes de "pensamiento" y junta solo el texto de la respuesta.
  const txt = (parts || [])
    .filter((p) => p && !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .replace(/```json|```/g, "")
    .trim();
  if (!txt) throw new Error("Gemini devolvió una respuesta vacía");
  try {
    return JSON.parse(txt);
  } catch {
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(txt.slice(a, b + 1));
    throw new Error("Gemini no devolvió un JSON válido");
  }
}

export async function POST(req: Request) {
  try {
    const { image, mime, kind, context } = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor" }, { status: 500 });
    const prompt = kind === "matches" ? matchesPrompt(context || {}) : PROMPTS[kind];
    if (!prompt || !image) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mime || "image/jpeg", data: image } }] }],
      // Los modelos 3.x no aceptan parámetros de muestreo (temperature, top_p…): no se envían.
      generationConfig: { responseMimeType: "application/json" },
    });

    let lastErr = "Gemini no respondió";
    for (const model of MODELS) {
      for (let intento = 0; intento < 2; intento++) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body,
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const cand = j.candidates?.[0];
          try {
            const out = parseJson(cand?.content?.parts || []);
            return NextResponse.json({ ...out, _model: model });
          } catch (e: any) {
            lastErr = `${model}: ${e.message}`;
            break; // prueba con el siguiente modelo
          }
        }
        lastErr = `${model}: ${j?.error?.message || r.status}`;
        if (r.status === 503 && intento === 0) { await sleep(1500); continue; } // saturado: un reintento
        break; // 429 (sin cuota), 404 (modelo no existe), 400…: siguiente modelo
      }
    }
    return NextResponse.json({ error: `Gemini no pudo leer la imagen. ${lastErr}` }, { status: 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error inesperado" }, { status: 500 });
  }
}
