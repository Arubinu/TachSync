/**
 * Guided capture protocol.
 *
 * Noting timings by hand while driving does not work: they are forgotten and approximated, and the
 * trace becomes useless exactly where it mattered. The assistant reverses the burden - one press
 * writes a timestamped marker into the log at the moment the step begins, and shows the next.
 *
 * The order is not arbitrary. It starts with what needs no driving, so the handshake and the
 * supported PIDs are captured even if the session stops there, then covers the extremes: without
 * firm acceleration and hard braking the style classifier has nothing to learn from.
 */

export interface CaptureStep {
  /** Stable id, written as-is into the log. */
  readonly id: string;
  /** What the step brings, so it can be explained rather than imposed. */
  readonly purpose: 'link' | 'baseline' | 'dynamics' | 'closing';
  /** Indicative duration, in seconds. `null` means as long as it takes. */
  readonly seconds: number | null;
}

export const CAPTURE_STEPS: readonly CaptureStep[] = [
  // Engine off: the handshake and the supported-PID masks, which alone decide which tiles are
  // usable on this vehicle.
  { id: 'ignition', purpose: 'link', seconds: 30 },
  { id: 'idle', purpose: 'baseline', seconds: 60 },
  { id: 'gentleAccel', purpose: 'baseline', seconds: null },
  // The heart of the capture: this is where boost and harshness are read.
  { id: 'firmAccel', purpose: 'dynamics', seconds: null },
  { id: 'liftOff', purpose: 'dynamics', seconds: null },
  { id: 'hardBrake', purpose: 'dynamics', seconds: null },
  { id: 'cornerLeft', purpose: 'dynamics', seconds: null },
  { id: 'cornerRight', purpose: 'dynamics', seconds: null },
  { id: 'cruise', purpose: 'baseline', seconds: 60 },
  { id: 'shutdown', purpose: 'closing', seconds: 30 },
];

export interface CaptureState {
  /** Current step, or `null` when the protocol is finished. */
  readonly step: CaptureStep | null;
  /** Index of the current step, from 1. */
  readonly index: number;
  readonly total: number;
  readonly done: boolean;
}

/**
 * Advances one step.
 *
 * With no way back, deliberately: at the wheel a "previous" button only ever gets pressed by
 * mistake, and a wrong marker in the log costs more than a missing one - the first lies, the second
 * can be inferred.
 */
export function advance(index: number): number {
  return Math.min(index + 1, CAPTURE_STEPS.length);
}

export function captureState(index: number): CaptureState {
  const step = CAPTURE_STEPS[index] ?? null;
  return {
    step,
    index: Math.min(index + 1, CAPTURE_STEPS.length),
    total: CAPTURE_STEPS.length,
    done: step === null,
  };
}

/** Log file name, dated like the backups. */
export function captureFileName(): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `capture-obd-${stamp}.txt`;
}
