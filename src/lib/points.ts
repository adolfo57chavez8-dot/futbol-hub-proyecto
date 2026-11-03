import { Comp, STAGE_WEIGHT } from "./competitions";
const clamp = (x: number) => Math.min(2, Math.max(0.5, x));
const r2 = (x: number) => Math.round(x * 100) / 100;
/** Puntos [local, visitante] = base × peso competición × peso fase × factor rival.
 *  Victoria +3, empate +1, derrota −1. Ganar a un rival más fuerte suma más; perder con uno más débil resta más. */
export function matchPoints(comp: Comp, stage: string, hs: number, as: number, hw: number, aw: number): [number, number] {
  const k = comp.weight * (STAGE_WEIGHT[stage] ?? 1);
  const one = (own: number, rival: number, res: "W" | "D" | "L") =>
    res === "W" ? 3 * k * clamp(rival / own) : res === "D" ? 1 * k * clamp(rival / own) : -1 * k * clamp(own / rival);
  const rh = hs > as ? "W" : hs < as ? "L" : "D";
  const ra = rh === "W" ? "L" : rh === "L" ? "W" : "D";
  return [r2(one(hw, aw, rh)), r2(one(aw, hw, ra as any))];
}
