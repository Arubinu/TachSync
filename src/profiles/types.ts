import type { LayoutConfig } from '../board/layout';
import type { ModeSignature } from '../obd/calibration';
import type { DriveMode } from '../analysis/driveMode';

/**
 * The three profile entities.
 *
 * A single "profile" object would mix three things that change at different rates and, above all,
 * are not shared the same way:
 *
 * - an APPEARANCE is shared between people: two drivers can like the same look; - a LAYOUT belongs
 * to the vehicle, being composed for one grid size; - a PERSON therefore holds almost nothing: a
 * name and a chosen appearance.
 *
 * Entities are associated rather than copied. A copy forks: fixing the original leaves the
 * duplicates wrong. Duplication is still offered, but as a deliberate starting point - duplicate to
 * diverge, associate to stay in step.
 */

/** What is visible: the look, the character, the text size. */
export interface Appearance {
  readonly id: string;
  readonly label: string;
  readonly themeId: string;
  /** `null` means the background supplied by the theme. */
  readonly backgroundId: string | null;
  readonly avatarId: string;
  /** Objects hidden on each avatar, by avatar id. Belongs to the look, like the avatar itself. */
  readonly hiddenAvatarParts: Readonly<Record<string, readonly string[]>>;
  readonly fontScale: number;
  readonly light: boolean;
}

/** Who is driving. Almost nothing, deliberately. */
export interface Person {
  readonly id: string;
  readonly label: string;
  /** Chosen appearance. Several people may point at the same one. */
  readonly appearanceId: string;
  /**
   * The face on their button, by id.
   *
   * A name is read; a face is recognised. On the screen that asks who is driving, the icon is what
   * lets someone answer without reading, which is the whole point of asking there rather than in a
   * settings list.
   */
  readonly icon: string;
}

/**
 * One grid, and who drives with it.
 *
 * People are listed on the grid rather than the grid being hung off each person: two drivers who
 * share a board share this object, so a tile moved by one has moved for the other. Nothing is
 * synchronised because nothing was duplicated.
 */
export interface VehicleLayout {
  readonly id: string;
  /** Person ids. Empty on a grid nobody has been placed on yet - the car's default. */
  readonly people: readonly string[];
  readonly portrait: LayoutConfig;
  readonly landscape: LayoutConfig;
}

/**
 * What is being driven.
 *
 * The adapter id is what lets the car be recognised on connect rather than asked for: it is stable
 * and already in hand at that moment. `null` for a hand-created vehicle, or for the simulator's.
 */
export interface Vehicle {
  readonly id: string;
  readonly label: string;
  readonly adapterId: string | null;
  /**
   * The car's grids, one per group of drivers. Never empty.
   *
   * Composed for this car - a grid is made for one screen size and one set of tiles, which is why
   * it lives here and not as an entity of its own that could be hung on any vehicle.
   */
  readonly layouts: readonly VehicleLayout[];
  /** Gauge full-scale values. See `VehicleRanges`. */
  readonly ranges: VehicleRanges;
  /** What the calibration measured on this car, or `null` if it was never run. */
  readonly calibration: VehicleCalibration | null;
}

/**
 * What the calibration learned about one car.
 *
 * Kept on the vehicle rather than in the flat settings: it describes this car and nothing else, and
 * moves with it when the driver changes.
 *
 * `modes` is what the driver declared their car offers, which is a different thing from what was
 * measured - a car may have three modes and have been calibrated on only two, and the screen has to
 * be able to say so.
 */
export interface VehicleCalibration {
  /** Modes the car offers, as declared. Empty on a car that has none. */
  readonly modes: readonly DriveMode[];
  /** One per mode actually driven. */
  readonly signatures: readonly ModeSignature<DriveMode>[];
  readonly idleRpm: number | null;
  readonly turbo: boolean | null;
  /**
   * Whether the redline was read off the limiter, or merely inferred from the highest reading.
   *
   * Kept so the summary can say which. A measurement and a floor deserve different confidence, and
   * only the second is worth correcting by hand.
   */
  readonly redlineMeasured: boolean;
  /**
   * How far the measured modes stand apart, `null` when fewer than two were driven.
   *
   * Stored because detection depends on it: below a threshold the modes cannot be told apart
   * afterwards, and the dashboard must fall back rather than guess.
   */
  readonly spread: number | null;
  /** When it was run, ISO. A calibration ages: tyres, season, a different fuel. */
  readonly at: string;
}

/**
 * What sets a gauge's full scale.
 *
 * Scales used to be hard-coded in tile rendering: 200 km/h and 7000 rpm for everyone. A city car
 * never reaches half the first and its needle stays flat; a sports car hits the stop in third. A
 * gauge that never uses its dial measures nothing.
 *
 * Two values only: the other channels are either universal (throttle and engine load are
 * percentages) or too engine-dependent to ask anyone to type in.
 */
export interface VehicleRanges {
  /** Speedometer full scale, km/h. */
  readonly speed: number;
  /** Redline, rpm. This is what places the dial's red zone. */
  readonly redline: number;
}

/**
 * Default scales, identical to the previously hard-coded ones, so an existing car does not see its
 * gauges change because a field appeared.
 */
export const DEFAULT_RANGES: VehicleRanges = { speed: 200, redline: 7000 };

/**
 * Rev counter full scale, derived from the redline.
 *
 * A dial always ends past the cut-off: an engine breaking at 6500 sits on a dial graduated to 8000.
 * That margin is what makes the red zone visible - without it the zone would sit at the very end,
 * where the needle never reaches.
 *
 * Derived rather than entered: this is how manufacturers draw their dials. One thousand of margin,
 * rounded up to the nearest thousand for round graduations.
 */
export function rpmScale(ranges: VehicleRanges): number {
  return Math.ceil((ranges.redline + 1000) / 1000) * 1000;
}

/**
 * Bounds and step for adjusting the two scales without typing a number.
 *
 * Nobody knows their top speed to the unit, and a 10 km/h or 500 rpm notch is enough to set a dial.
 * The bounds only rule out the absurd.
 */
export const RANGE_LIMITS = {
  speed: { min: 60, max: 400, step: 10 },
  redline: { min: 2000, max: 12000, step: 500 },
} as const;

export function stepRange(
  ranges: VehicleRanges,
  key: keyof VehicleRanges,
  direction: 1 | -1,
): VehicleRanges {
  const limits = RANGE_LIMITS[key];
  const next = ranges[key] + direction * limits.step;
  return { ...ranges, [key]: Math.min(limits.max, Math.max(limits.min, next)) };
}
