/**
 * Vehicle physics model.
 *
 * Deliberately physical rather than pleasant-looking random noise: the analysis engines are meant
 * to read quantities that are consistent with each other. A consumption figure not actually derived
 * from mass air flow - itself from revs and manifold pressure - would produce a classifier
 * validated on lying data.
 *
 * The formulas used (road load, speed-density for MAF) are the standard ones, with checkable orders
 * of magnitude: ~1 L/h at idle, ~5-6 L/100 km at steady cruise.
 */

export interface VehicleSpec {
  readonly label: string;
  /** Kerb mass, kg. */
  readonly mass: number;
  /** Displacement, L. */
  readonly displacement: number;
  readonly turbocharged: boolean;
  /** Max boost, kPa above atmospheric (0 if naturally aspirated). */
  readonly maxBoost: number;
  /** Peak torque, N.m. */
  readonly peakTorque: number;
  readonly idleRpm: number;
  readonly redlineRpm: number;
  /** Gear ratios, first to last. */
  readonly gearRatios: readonly number[];
  readonly finalDrive: number;
  /** Loaded wheel radius, m. */
  readonly wheelRadius: number;
  /** Drag coefficient times frontal area, m2. */
  readonly dragArea: number;
  /** Rolling resistance coefficient. */
  readonly rollingResistance: number;
  /** Maximum braking force, N. */
  readonly maxBrakeForce: number;
}

/** Turbocharged ~2 L hot hatch - the interesting case, with a live boost gauge. */
export const HOT_HATCH_TURBO: VehicleSpec = {
  label: 'Compacte sportive 2.0T',
  mass: 1400,
  displacement: 2.0,
  turbocharged: true,
  maxBoost: 90,
  peakTorque: 320,
  idleRpm: 800,
  redlineRpm: 6800,
  gearRatios: [3.55, 2.04, 1.38, 1.03, 0.81, 0.66],
  finalDrive: 3.9,
  wheelRadius: 0.31,
  dragArea: 0.68,
  rollingResistance: 0.013,
  maxBrakeForce: 9500,
};

/**
 * Naturally aspirated city car - exercises the "channel unavailable" path: without a turbo the
 * boost gauge must disappear from the UI.
 */
export const CITY_CAR_NA: VehicleSpec = {
  label: 'Citadine 1.2 atmo',
  mass: 1050,
  displacement: 1.2,
  turbocharged: false,
  maxBoost: 0,
  peakTorque: 118,
  idleRpm: 750,
  redlineRpm: 6200,
  gearRatios: [3.73, 2.05, 1.32, 0.98, 0.76],
  finalDrive: 4.06,
  wheelRadius: 0.28,
  dragArea: 0.72,
  rollingResistance: 0.014,
  maxBrakeForce: 7200,
};

export const VEHICLE_PRESETS: readonly VehicleSpec[] = [HOT_HATCH_TURBO, CITY_CAR_NA];

/** Internal state of the simulated vehicle. */
export interface VehicleState {
  /** Speed, m/s. */
  speed: number;
  /** Current longitudinal acceleration, m/s2. */
  acceleration: number;
  rpm: number;
  /** Engaged gear, 1..n. */
  gear: number;
  /** Manifold pressure, absolute kPa. */
  map: number;
  coolantTemp: number;
  /** Time since start, s. */
  elapsed: number;
}

export const AIR_DENSITY = 1.225;
export const GRAVITY = 9.81;
export const BAROMETRIC_KPA = 101.3;
/** Assumed intake temperature, K (25 C). */
const INTAKE_AIR_TEMP_K = 298;
/** Average volumetric efficiency. */
const VOLUMETRIC_EFFICIENCY = 0.85;
/** Molar mass of air over the ideal gas constant (28.97 / 8.314). */
const AIR_MOLAR_GAS_RATIO = 3.484;
/** Drivetrain efficiency. */
const DRIVETRAIN_EFFICIENCY = 0.9;
const AMBIENT_TEMP_C = 18;
const OPERATING_TEMP_C = 92;

export function createVehicleState(spec: VehicleSpec): VehicleState {
  return {
    speed: 0,
    acceleration: 0,
    rpm: spec.idleRpm,
    gear: 1,
    map: idleMap(),
    coolantTemp: AMBIENT_TEMP_C,
    elapsed: 0,
  };
}

function idleMap(): number {
  // Throttle closed: strong manifold vacuum.
  return BAROMETRIC_KPA * 0.3;
}

export function gearRatio(spec: VehicleSpec, gear: number): number {
  const index = clamp(Math.round(gear), 1, spec.gearRatios.length) - 1;
  return spec.gearRatios[index] ?? 1;
}

export function topGear(spec: VehicleSpec): number {
  return spec.gearRatios.length;
}

/**
 * Normalised torque curve: a bell peaking around 55% of max revs. Enough that acceleration fades
 * high in the range, which makes gear changes credible.
 */
export function torqueFactor(spec: VehicleSpec, rpm: number): number {
  const x = clamp(rpm / spec.redlineRpm, 0, 1.05);
  return clamp(1 - 2.2 * (x - 0.55) ** 2, 0.2, 1);
}

/** Engine speed imposed by road speed and engaged gear. */
export function rpmForSpeed(spec: VehicleSpec, speedMs: number, gear: number): number {
  const wheelRevsPerSecond = speedMs / (2 * Math.PI * spec.wheelRadius);
  const engineRpm = wheelRevsPerSecond * 60 * spec.finalDrive * gearRatio(spec, gear);
  // Below idle the clutch slips: the engine does not stall.
  return clamp(engineRpm, spec.idleRpm, spec.redlineRpm);
}

/**
 * Manifold pressure: vacuum at closed throttle, near atmospheric at full load, plus boost when the
 * turbo is on song.
 */
export function manifoldPressure(spec: VehicleSpec, throttle: number, rpm: number): number {
  const naturallyAspirated = BAROMETRIC_KPA * (0.3 + 0.7 * throttle);
  if (!spec.turbocharged) return naturallyAspirated;
  // Boost builds with revs: next to nothing below 1500 rpm.
  const spool = clamp((rpm - 1500) / 2200, 0, 1);
  return naturallyAspirated + spec.maxBoost * throttle * spool;
}

/** Mass air flow by the speed-density method (g/s). */
export function massAirFlow(spec: VehicleSpec, rpm: number, map: number): number {
  const imap = (rpm * map) / (INTAKE_AIR_TEMP_K * 2);
  return (imap / 60) * VOLUMETRIC_EFFICIENCY * spec.displacement * AIR_MOLAR_GAS_RATIO;
}

/** Calculated engine load, % - ratio of current to maximum filling. */
export function engineLoad(spec: VehicleSpec, map: number): number {
  return clamp((map / (BAROMETRIC_KPA + spec.maxBoost)) * 100, 0, 100);
}

export interface VehicleInputs {
  /** Accelerator pedal position, 0..1. */
  readonly throttle: number;
  /** Brake pedal position, 0..1. */
  readonly brake: number;
  /** Upshift rpm (depends on driving style). */
  readonly shiftUpRpm: number;
  /** Downshift rpm. */
  readonly shiftDownRpm: number;
}

/**
 * Advances the simulation by one time step.
 *
 * Force balance: engine traction minus aerodynamic drag minus rolling resistance minus braking, all
 * divided by mass.
 */
export function stepVehicle(
  spec: VehicleSpec,
  state: VehicleState,
  inputs: VehicleInputs,
  dt: number,
): void {
  const throttle = clamp(inputs.throttle, 0, 1);
  const brake = clamp(inputs.brake, 0, 1);

  state.rpm = rpmForSpeed(spec, state.speed, state.gear);

  // Gearbox: no shifting off-throttle or at a standstill.
  if (state.speed > 1) {
    if (state.rpm >= inputs.shiftUpRpm && state.gear < topGear(spec)) {
      state.gear += 1;
    } else if (state.rpm <= inputs.shiftDownRpm && state.gear > 1) {
      state.gear -= 1;
    }
    state.rpm = rpmForSpeed(spec, state.speed, state.gear);
  } else {
    state.gear = 1;
    state.rpm = spec.idleRpm;
  }

  state.map = manifoldPressure(spec, throttle, state.rpm);

  const boostMultiplier = spec.turbocharged ? state.map / BAROMETRIC_KPA : 1;
  const engineTorque = spec.peakTorque * torqueFactor(spec, state.rpm) * throttle * boostMultiplier;
  const tractiveForce =
    (engineTorque * gearRatio(spec, state.gear) * spec.finalDrive * DRIVETRAIN_EFFICIENCY) /
    spec.wheelRadius;

  const dragForce = 0.5 * AIR_DENSITY * spec.dragArea * state.speed ** 2;
  const rollingForce = state.speed > 0.1 ? spec.rollingResistance * spec.mass * GRAVITY : 0;
  const brakeForce = brake * spec.maxBrakeForce;

  const netForce = tractiveForce - dragForce - rollingForce - brakeForce;
  state.acceleration = netForce / spec.mass;
  state.speed = Math.max(0, state.speed + state.acceleration * dt);

  // The engine reaches operating temperature in a few minutes.
  const warmupRate = 0.35;
  state.coolantTemp += (OPERATING_TEMP_C - state.coolantTemp) * warmupRate * dt * 0.1;

  state.elapsed += dt;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const MS_TO_KMH = 3.6;
