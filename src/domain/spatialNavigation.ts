export type Direction = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
export interface FocusRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Pick the closest visible control in the intended half-plane. */
export function nextSpatialIndex(
  current: FocusRect,
  candidates: FocusRect[],
  direction: Direction,
): number {
  const horizontal = direction === "ArrowLeft" || direction === "ArrowRight";
  const sign = direction === "ArrowLeft" || direction === "ArrowUp" ? -1 : 1;
  const cx = current.left + current.width / 2,
    cy = current.top + current.height / 2;
  let best = -1,
    score = Infinity;
  candidates.forEach((r, i) => {
    const dx = r.left + r.width / 2 - cx,
      dy = r.top + r.height / 2 - cy;
    const forward = (horizontal ? dx : dy) * sign;
    const across = Math.abs(horizontal ? dy : dx);
    if (forward <= 1) return;
    const value =
      forward + across * 3 + (across * across) / Math.max(forward, 1);
    if (value < score) {
      best = i;
      score = value;
    }
  });
  return best;
}
