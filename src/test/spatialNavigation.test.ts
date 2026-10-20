import { describe, it, expect } from "vitest";
import { nextSpatialIndex, type FocusRect } from "../domain/spatialNavigation";
const rectangle = (x: number, y: number): FocusRect => ({
  left: x,
  top: y,
  width: 100,
  height: 50,
});
describe("directional TV navigation", () => {
  it("follows aligned rows instead of jumping diagonally into another panel", () => {
    expect(
      nextSpatialIndex(
        rectangle(0, 0),
        [rectangle(0, 80), rectangle(160, 40)],
        "ArrowDown",
      ),
    ).toBe(0);
  });
  it("does not wrap to controls behind the requested direction", () => {
    expect(
      nextSpatialIndex(
        rectangle(0, 0),
        [rectangle(0, 80), rectangle(160, 0)],
        "ArrowUp",
      ),
    ).toBe(-1);
  });
  it("supports right and left movement between panels", () => {
    expect(
      nextSpatialIndex(rectangle(0, 0), [rectangle(150, 0)], "ArrowRight"),
    ).toBe(0);
    expect(
      nextSpatialIndex(rectangle(150, 0), [rectangle(0, 0)], "ArrowLeft"),
    ).toBe(0);
  });
  it("does not select the focused control again", () => {
    expect(
      nextSpatialIndex(rectangle(0, 0), [rectangle(0, 0)], "ArrowDown"),
    ).toBe(-1);
  });
});
