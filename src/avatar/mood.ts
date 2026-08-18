import { DrivingStyleTracker, type DrivingStyle } from '../analysis/drivingStyle';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';
import type { AvatarFrameState, AvatarMood, AvatarReaction } from './types';

/**
 * Turns telemetry into avatar state.
 *
 * Mood comes from the driving-style classifier; what remains here belongs to the character itself -
 * elapsed time, blinks, startles - plus the style-to-mood mapping. `AvatarFrameState` is the
 * boundary, so characters never learn where mood came from.
 */

/**
 * Driving style to avatar mood.
 *
 * Kept as an explicit table rather than making the two enums coincide, so a new driving style does
 * not force a new mood into existence.
 */
const MOODS: Record<DrivingStyle, AvatarMood> = {
  calm: 'calm',
  normal: 'neutral',
  spirited: 'spirited',
  aggressive: 'tense',
};

/** Minimum delay between reactions, in seconds. Without it the character convulses. */
const REACTION_COOLDOWN = 1.1;
/** Deceleration that makes the character flinch, in g. */
const STARTLE_THRESHOLD_G = 0.32;
/** Acceleration that makes it cheer, in g. */
const THRILL_THRESHOLD_G = 0.28;

export class MoodTracker {
  #style = new DrivingStyleTracker();
  #shift = 0;

  /**
   * Shifts the style thresholds by what this driver's own trips suggest.
   *
   * Kept on the tracker rather than passed each frame: it changes when the history does, which is
   * once a trip, where a frame arrives sixty times a second.
   */
  setBaselineShift(shift: number): void {
    this.#shift = shift;
    this.#style.setBaselineShift(shift);
  }
  #time = 0;
  #reactionCooldown = 0;
  #nextBlink = 2;
  #previousGear: number | null = null;

  reset(): void {
    this.#style = new DrivingStyleTracker();
    this.#style.setBaselineShift(this.#shift);
    this.#time = 0;
    this.#reactionCooldown = 0;
    this.#nextBlink = 2;
    this.#previousGear = null;
  }

  feed(snapshot: TelemetrySnapshot, dt: number, redline: number): AvatarFrameState {
    this.#time += dt;
    this.#reactionCooldown = Math.max(0, this.#reactionCooldown - dt);
    this.#nextBlink -= dt;

    this.#style.observe(snapshot, dt, redline);

    const { frame } = snapshot;
    const lateral = frame.lateralG ?? 0;
    const longitudinal = frame.longitudinalG ?? 0;
    const { energy, harshness } = this.#style.levels;

    return {
      mood: MOODS[this.#style.style],
      intensity: clamp01(Math.max(energy, harshness)),
      revs: clamp01((frame.rpm ?? 0) / redline),
      effort: clamp01((frame.throttle ?? 0) / 100),
      lateral,
      longitudinal,
      time: this.#time,
      reaction: this.#detectReaction(frame.gear, longitudinal),
    };
  }

  #detectReaction(gear: number | null, longitudinal: number): AvatarReaction | null {
    const gearChanged =
      this.#previousGear !== null && gear !== null && gear !== this.#previousGear && gear > 0;
    this.#previousGear = gear;

    if (this.#reactionCooldown > 0) return null;

    // Strong reactions win: a braking flinch must not be replaced by a blink.
    if (longitudinal < -STARTLE_THRESHOLD_G) return this.#fire('startle');
    if (longitudinal > THRILL_THRESHOLD_G) return this.#fire('thrill');
    if (gearChanged) return this.#fire('shift');

    if (this.#nextBlink <= 0) {
      // Irregular cadence - a perfectly periodic blink looks mechanical.
      this.#nextBlink = 2.5 + Math.random() * 4;
      return this.#fire('blink');
    }

    return null;
  }

  #fire(reaction: AvatarReaction): AvatarReaction {
    // A blink must not block a startle that follows closely.
    this.#reactionCooldown = reaction === 'blink' ? 0.2 : REACTION_COOLDOWN;
    return reaction;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
