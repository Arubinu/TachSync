/**
 * Vehicle telemetry model.
 *
 * Central rule of the project: `null` means "channel unavailable" - the PID is not supported by
 * this vehicle, or has not been read yet. It is NOT zero. A naturally aspirated car has no boost
 * pressure, and the UI must hide the corresponding gauge rather than show 0 bar.
 */

/**
 * Derived channels: not PIDs, but quantities computed from several raw channels. They belong in the
 * available-channel list because a tile can depend on one - and a tile whose channel is missing
 * must not show at all.
 */
export type DerivedChannel = 'boost' | 'consumption';

export type AnyChannel = TelemetryChannel | DerivedChannel;

/** Individually addressable telemetry channels. */
export type TelemetryChannel =
  | 'speed'
  | 'rpm'
  | 'throttle'
  | 'engineLoad'
  | 'map'
  | 'barometric'
  | 'maf'
  | 'fuelRate'
  | 'coolantTemp'
  | 'gear'
  | 'lateralG'
  | 'longitudinalG';

/**
 * Vehicle snapshot. Comments give the originating standard OBD-II PID (mode 01), or `sensor` for
 * what comes from the phone.
 */
export interface TelemetryFrame {
  /** Measurement timestamp (ms, epoch). */
  readonly timestamp: number;
  /** Vehicle speed, km/h - PID 0x0D */
  readonly speed: number | null;
  /** Engine speed, rpm - PID 0x0C */
  readonly rpm: number | null;
  /** Throttle position, % - PID 0x11 */
  readonly throttle: number | null;
  /** Calculated engine load, % - PID 0x04 */
  readonly engineLoad: number | null;
  /** Intake manifold pressure, absolute kPa - PID 0x0B */
  readonly map: number | null;
  /** Barometric pressure, kPa - PID 0x33 */
  readonly barometric: number | null;
  /** Mass air flow, g/s - PID 0x10 */
  readonly maf: number | null;
  /** Instantaneous fuel rate, L/h - PID 0x5E (rarely supported) */
  readonly fuelRate: number | null;
  /** Coolant temperature, C - PID 0x05 */
  readonly coolantTemp: number | null;
  /** Engaged gear (0 = neutral). Inferred, or a manufacturer PID. */
  readonly gear: number | null;
  /** Lateral acceleration, g - phone DeviceMotion sensor. */
  readonly lateralG: number | null;
  /** Longitudinal acceleration, g - sensor, or derived from speed. */
  readonly longitudinalG: number | null;
}

/** Empty frame: every channel unavailable. Base for building a partial frame. */
export const EMPTY_FRAME: TelemetryFrame = {
  timestamp: 0,
  speed: null,
  rpm: null,
  throttle: null,
  engineLoad: null,
  map: null,
  barometric: null,
  maf: null,
  fuelRate: null,
  coolantTemp: null,
  gear: null,
  lateralG: null,
  longitudinalG: null,
};

/**
 * Boost pressure, in relative kPa (0 = atmospheric).
 *
 * There is no standard boost PID: it is derived from the difference between manifold and barometric
 * pressure. Returns `null` if either channel is missing, in which case the boost gauge must be
 * hidden.
 */
export function boostPressure(frame: TelemetryFrame): number | null {
  if (frame.map === null || frame.barometric === null) return null;
  return frame.map - frame.barometric;
}

/**
 * Instantaneous consumption in L/100 km.
 *
 * Undefined at a standstill (no dividing by zero speed): the UI must then fall back to L/h, which
 * stays meaningful at idle.
 */
export function consumptionPer100km(frame: TelemetryFrame): number | null {
  const fuelRate = fuelRateLitresPerHour(frame);
  if (fuelRate === null || frame.speed === null || frame.speed < 5) return null;
  return (fuelRate / frame.speed) * 100;
}

/**
 * Consumption in L/h, measured if the vehicle exposes PID 0x5E, otherwise estimated from mass air
 * flow: most vehicles only give MAF, so the estimate is the common case rather than the exception.
 */
export function fuelRateLitresPerHour(frame: TelemetryFrame): number | null {
  if (frame.fuelRate !== null) return frame.fuelRate;
  if (frame.maf === null) return null;
  // Stoichiometric petrol mixture (14.7:1) and density ~745 g/L.
  const fuelGramsPerSecond = frame.maf / STOICHIOMETRIC_AFR;
  return (fuelGramsPerSecond * 3600) / PETROL_DENSITY_G_PER_L;
}

export const STOICHIOMETRIC_AFR = 14.7;
export const PETROL_DENSITY_G_PER_L = 745;

/** Lists the channels actually populated in a frame. */
export function presentChannels(frame: TelemetryFrame): Set<TelemetryChannel> {
  const present = new Set<TelemetryChannel>();
  for (const channel of ALL_CHANNELS) {
    if (frame[channel] !== null) present.add(channel);
  }
  return present;
}

export const ALL_CHANNELS: readonly TelemetryChannel[] = [
  'speed',
  'rpm',
  'throttle',
  'engineLoad',
  'map',
  'barometric',
  'maf',
  'fuelRate',
  'coolantTemp',
  'gear',
  'lateralG',
  'longitudinalG',
];
