/**
 * Driver model.
 *
 * Produces pedal and steering inputs from a behaviour profile. It is the counterpart of the physics
 * model: this is where the difference between calm and aggressive driving originates - the very
 * difference the analysis engines have to recover.
 *
 * Profiles differ along exactly the axes that get measured: pedal abruptness, throttle opening,
 * shift rpm, braking violence, cornering speed.
 */

import { clamp } from './vehicle';

export type DrivingProfile = 'eco' | 'normal' | 'sporty' | 'aggressive';

export const DRIVING_PROFILES: readonly DrivingProfile[] = ['eco', 'normal', 'sporty', 'aggressive'];


export interface ProfileParams {
  /** Pedal travel rate, pedal units per second. */
  readonly pedalRate: number;
  /** Maximum throttle opening under acceleration, 0..1. */
  readonly maxThrottle: number;
  /** Typical braking intensity, 0..1. */
  readonly brakeIntensity: number;
  readonly shiftUpRpm: number;
  readonly shiftDownRpm: number;
  /** Target cruising speed range, km/h. */
  readonly cruiseSpeedKmh: readonly [number, number];
  /** Typical lateral acceleration in corners, g. */
  readonly corneringG: number;
  /** Average duration of a phase (cruise, acceleration...), s. */
  readonly phaseDuration: number;
}

export const PROFILE_PARAMS: Record<DrivingProfile, ProfileParams> = {
  eco: {
    pedalRate: 0.35,
    maxThrottle: 0.35,
    brakeIntensity: 0.18,
    shiftUpRpm: 2200,
    shiftDownRpm: 1250,
    cruiseSpeedKmh: [45, 80],
    corneringG: 0.15,
    phaseDuration: 14,
  },
  normal: {
    pedalRate: 0.7,
    maxThrottle: 0.55,
    brakeIntensity: 0.3,
    shiftUpRpm: 2900,
    shiftDownRpm: 1400,
    cruiseSpeedKmh: [50, 95],
    corneringG: 0.3,
    phaseDuration: 11,
  },
  sporty: {
    pedalRate: 1.6,
    maxThrottle: 0.85,
    brakeIntensity: 0.55,
    shiftUpRpm: 4600,
    shiftDownRpm: 2100,
    cruiseSpeedKmh: [60, 120],
    corneringG: 0.55,
    phaseDuration: 8,
  },
  aggressive: {
    pedalRate: 3.2,
    maxThrottle: 1,
    brakeIntensity: 0.9,
    shiftUpRpm: 6200,
    shiftDownRpm: 2800,
    cruiseSpeedKmh: [70, 140],
    corneringG: 0.85,
    phaseDuration: 5,
  },
};

type DriverPhase = 'accelerating' | 'cruising' | 'braking' | 'stopped';

export interface DriverState {
  phase: DriverPhase;
  /** Time left in the current phase, s. */
  phaseTimer: number;
  /** Target speed, m/s. */
  targetSpeed: number;
  throttle: number;
  brake: number;
  /** Current lateral acceleration, signed g (negative is a left-hand turn). */
  lateralG: number;
  /** Target lateral g for the current corner. */
  targetLateralG: number;
  /** Time left in the corner, s. */
  cornerTimer: number;
}

/**
 * Deterministic pseudo-random generator (mulberry32).
 *
 * Essential: without a fixed seed there could be no reproducible test asserting that an aggressive
 * scenario is classified aggressive.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDriverState(): DriverState {
  return {
    phase: 'stopped',
    phaseTimer: 1.5,
    targetSpeed: 0,
    throttle: 0,
    brake: 0,
    lateralG: 0,
    targetLateralG: 0,
    cornerTimer: 0,
  };
}

export interface DriverInputs {
  readonly throttle: number;
  readonly brake: number;
  readonly lateralG: number;
}

/**
 * Advances the driver by one time step and returns the pedal commands.
 *
 * Pedals are eased towards a setpoint, never applied as steps: the speed of that easing, driven by
 * `pedalRate`, is what creates the jerk characteristic of aggressive driving.
 */
export function stepDriver(
  state: DriverState,
  profile: DrivingProfile,
  currentSpeedMs: number,
  dt: number,
  random: () => number,
): DriverInputs {
  const params = PROFILE_PARAMS[profile];

  state.phaseTimer -= dt;
  if (state.phaseTimer <= 0) {
    advancePhase(state, params, random);
  }

  let targetThrottle = 0;
  let targetBrake = 0;

  switch (state.phase) {
    case 'accelerating': {
      targetThrottle = params.maxThrottle;
      // Once the setpoint is reached, move on to cruising.
      if (currentSpeedMs >= state.targetSpeed) {
        state.phase = 'cruising';
        state.phaseTimer = params.phaseDuration * (0.6 + random());
      }
      break;
    }
    case 'cruising': {
      // Simple proportional control around the target speed.
      const error = state.targetSpeed - currentSpeedMs;
      targetThrottle = clamp(0.12 + error * 0.08, 0, params.maxThrottle);
      if (error < -2) targetBrake = clamp(-error * 0.05, 0, params.brakeIntensity);
      break;
    }
    case 'braking': {
      targetBrake = params.brakeIntensity;
      if (currentSpeedMs <= state.targetSpeed) {
        state.phase = state.targetSpeed < 0.5 ? 'stopped' : 'cruising';
        state.phaseTimer = params.phaseDuration * (0.5 + random());
      }
      break;
    }
    case 'stopped': {
      targetThrottle = 0;
      targetBrake = 1;
      break;
    }
  }

  state.throttle = approach(state.throttle, targetThrottle, params.pedalRate * dt);
  state.brake = approach(state.brake, targetBrake, params.pedalRate * 1.5 * dt);

  stepCornering(state, params, currentSpeedMs, dt, random);

  return { throttle: state.throttle, brake: state.brake, lateralG: state.lateralG };
}

function advancePhase(state: DriverState, params: ProfileParams, random: () => number): void {
  const [minKmh, maxKmh] = params.cruiseSpeedKmh;
  const roll = random();

  switch (state.phase) {
    case 'stopped':
    case 'braking': {
      state.phase = 'accelerating';
      state.targetSpeed = (minKmh + random() * (maxKmh - minKmh)) / 3.6;
      break;
    }
    case 'accelerating': {
      state.phase = 'cruising';
      break;
    }
    case 'cruising': {
      if (roll < 0.35) {
        // Full stop: red light, stop sign.
        state.phase = 'braking';
        state.targetSpeed = 0;
      } else if (roll < 0.7) {
        // Partial slowdown.
        state.phase = 'braking';
        state.targetSpeed = (minKmh * 0.5 + random() * minKmh * 0.4) / 3.6;
      } else {
        state.phase = 'accelerating';
        state.targetSpeed = (minKmh + random() * (maxKmh - minKmh)) / 3.6;
      }
      break;
    }
  }

  state.phaseTimer = params.phaseDuration * (0.7 + random() * 0.8);
}

/**
 * Corners: lateral g does not exist in OBD, it will come from the phone's accelerometer. Simulated
 * here so the analysis can be developed now.
 */
function stepCornering(
  state: DriverState,
  params: ProfileParams,
  currentSpeedMs: number,
  dt: number,
  random: () => number,
): void {
  state.cornerTimer -= dt;
  if (state.cornerTimer <= 0) {
    const entersCorner = random() < 0.45;
    if (entersCorner && currentSpeedMs > 4) {
      const direction = random() < 0.5 ? -1 : 1;
      state.targetLateralG = direction * params.corneringG * (0.6 + random() * 0.7);
      state.cornerTimer = 1.5 + random() * 3;
    } else {
      state.targetLateralG = 0;
      state.cornerTimer = 2 + random() * 4;
    }
  }

  // No lateral g at a standstill, whatever the setpoint.
  const achievable = currentSpeedMs > 2 ? state.targetLateralG : 0;
  state.lateralG = approach(state.lateralG, achievable, 1.5 * dt);
}

function approach(current: number, target: number, maxStep: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}
