/**
 * Reducer for the carousel's measured-aspect-ratio map.
 *
 * Extracted and tested because this exact bug has shipped twice as React error #185
 * ("Maximum update depth exceeded"):
 *
 *   the measured ratio drives the carousel's container height
 *     -> the height change toggles the page scrollbar
 *       -> the viewport width crosses the 640px <source> breakpoint
 *         -> the browser selects the other image in the <picture>
 *           -> a different natural ratio is measured
 *             -> setState -> repeat
 *
 * The loop can only start if setState produces a new object when nothing changed, so
 * returning `prev` unchanged is not a micro-optimisation — it is what terminates it.
 */
export function mergeAspectRatio(
  prev: Record<string, number>,
  key: string,
  ratio: number
): Record<string, number> {
  if (!Number.isFinite(ratio) || ratio <= 0) return prev;
  if (prev[key] === ratio) return prev;
  return { ...prev, [key]: ratio };
}
