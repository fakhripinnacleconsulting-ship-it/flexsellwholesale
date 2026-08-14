import { describe, it, expect } from "vitest";
import { mergeAspectRatio } from "../aspectRatioState";

/**
 * Regression tests for React error #185 ("Maximum update depth exceeded") on the
 * homepage carousel. This has shipped twice; the cause both times was a state update
 * that produced a new object even when the measured ratio had not changed.
 */
describe("mergeAspectRatio", () => {
  it("returns the SAME object reference when the ratio is unchanged", () => {
    // The identity check is the whole point: a new object here re-renders the carousel,
    // which re-measures, which re-renders — the infinite loop behind error #185.
    const prev = { "0-desktop": 1.5 };
    expect(mergeAspectRatio(prev, "0-desktop", 1.5)).toBe(prev);
  });

  it("stores a new ratio for a new key", () => {
    const prev = { "0-desktop": 1.5 };
    const next = mergeAspectRatio(prev, "0-mobile", 0.8);
    expect(next).not.toBe(prev);
    expect(next).toEqual({ "0-desktop": 1.5, "0-mobile": 0.8 });
  });

  it("updates an existing key when the ratio genuinely changes", () => {
    const prev = { "0-desktop": 1.5 };
    const next = mergeAspectRatio(prev, "0-desktop", 2.5);
    expect(next).not.toBe(prev);
    expect(next["0-desktop"]).toBe(2.5);
  });

  it("ignores unusable measurements instead of storing them", () => {
    // A detached or still-loading <img> reports 0, and 0/0 is NaN. Storing either would
    // set aspect-ratio to an invalid value and re-trigger measurement on every render.
    const prev = { "0-desktop": 1.5 };
    expect(mergeAspectRatio(prev, "0-desktop", 0)).toBe(prev);
    expect(mergeAspectRatio(prev, "0-desktop", NaN)).toBe(prev);
    expect(mergeAspectRatio(prev, "0-desktop", Infinity)).toBe(prev);
    expect(mergeAspectRatio(prev, "0-desktop", -2)).toBe(prev);
  });

  it("converges when the same measurement is applied repeatedly", () => {
    // Simulates the scrollbar/breakpoint feedback loop: repeated identical measurements
    // must stop producing new state, otherwise React never settles.
    let state: Record<string, number> = {};
    state = mergeAspectRatio(state, "0-desktop", 1.777);
    const afterFirst = state;
    for (let i = 0; i < 50; i++) {
      state = mergeAspectRatio(state, "0-desktop", 1.777);
    }
    expect(state).toBe(afterFirst);
  });
});
