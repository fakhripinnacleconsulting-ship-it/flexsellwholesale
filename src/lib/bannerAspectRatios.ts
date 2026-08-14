/**
 * Fixed aspect ratios for banner sections.
 *
 * The hero carousel sizes itself from each slide's *natural* ratio, so a section holding
 * images of different shapes resizes as it rotates and pushes the rest of the page around
 * — a visible layout shift and a CLS penalty.
 *
 * Banner sections instead pick one ratio for the whole section. Every slide is then
 * rendered into an identically sized box (cropped with object-cover), so the container
 * never changes height no matter how many banners there are or what shape they were
 * uploaded at.
 */

export interface AspectRatioPreset {
  /** Stored value — a "W:H" string, so the CMS payload stays readable. */
  key: string;
  label: string;
  /** width / height */
  value: number;
  /** Recommended source dimensions, shown to the admin at upload time. */
  recommended: string;
}

export const DESKTOP_ASPECT_PRESETS: AspectRatioPreset[] = [
  { key: "4:1", label: "Ultra-wide strip (4:1)", value: 4, recommended: "2400 × 600" },
  { key: "3:1", label: "Wide banner (3:1)", value: 3, recommended: "2100 × 700" },
  { key: "21:9", label: "Cinematic (21:9)", value: 21 / 9, recommended: "2100 × 900" },
  { key: "16:9", label: "Standard (16:9)", value: 16 / 9, recommended: "1920 × 1080" },
  { key: "3:2", label: "Classic (3:2)", value: 3 / 2, recommended: "1800 × 1200" },
  { key: "4:3", label: "Boxy (4:3)", value: 4 / 3, recommended: "1600 × 1200" },
];

export const MOBILE_ASPECT_PRESETS: AspectRatioPreset[] = [
  { key: "16:9", label: "Wide (16:9)", value: 16 / 9, recommended: "1080 × 608" },
  { key: "4:3", label: "Boxy (4:3)", value: 4 / 3, recommended: "1080 × 810" },
  { key: "1:1", label: "Square (1:1)", value: 1, recommended: "1080 × 1080" },
  { key: "4:5", label: "Portrait (4:5)", value: 0.8, recommended: "1080 × 1350" },
  { key: "3:4", label: "Tall (3:4)", value: 0.75, recommended: "1080 × 1440" },
];

export const DEFAULT_DESKTOP_RATIO = "3:1";
export const DEFAULT_MOBILE_RATIO = "4:3";

/** Parses a "W:H" key into a number. Falls back to the given default when unrecognised. */
export function parseAspectRatio(key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  const match = key.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) return fallback;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return fallback;
  return w / h;
}

export function getPreset(key: string | undefined, presets: AspectRatioPreset[]): AspectRatioPreset | undefined {
  return presets.find((p) => p.key === key);
}

/**
 * Resolves a section's desktop and mobile ratios to numbers, applying defaults.
 */
export function resolveSectionRatios(section: {
  aspectRatio?: string;
  mobileAspectRatio?: string;
}): { desktop: number; mobile: number } {
  return {
    desktop: parseAspectRatio(section.aspectRatio, parseAspectRatio(DEFAULT_DESKTOP_RATIO, 3)),
    mobile: parseAspectRatio(
      section.mobileAspectRatio || section.aspectRatio,
      parseAspectRatio(DEFAULT_MOBILE_RATIO, 4 / 3)
    ),
  };
}

/**
 * How far an uploaded image may deviate from the target ratio before we warn.
 *
 * 8% is roughly the point where object-cover starts visibly cropping something the admin
 * intended to be visible; below that the crop is imperceptible.
 */
export const RATIO_TOLERANCE = 0.08;

export function ratioDeviation(actual: number, target: number): number {
  if (!target) return 0;
  return Math.abs(actual - target) / target;
}

/** Human-readable "W:H" for an arbitrary measured ratio, for warning messages. */
export function describeRatio(value: number): string {
  const candidates = [...DESKTOP_ASPECT_PRESETS, ...MOBILE_ASPECT_PRESETS];
  const closest = candidates.reduce((best, p) =>
    Math.abs(p.value - value) < Math.abs(best.value - value) ? p : best
  );
  if (ratioDeviation(value, closest.value) < 0.02) return closest.key;
  return `${value.toFixed(2)}:1`;
}
