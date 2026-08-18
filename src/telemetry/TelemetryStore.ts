import { EMPTY_FRAME, fuelRateLitresPerHour, type TelemetryFrame } from './types';

/**
 * Distributes frames to the tiles.
 *
 * Key performance point: displayed values do NOT pass through React state. A grid of a dozen tiles
 * refreshed at 10 Hz through `setState` would rebuild the whole tree on every frame, which is
 * immediately visible on a phone. Here the store keeps the last frame and each tile writes straight
 * into its DOM node, once per screen refresh.
 *
 * React therefore re-renders only on what changes slowly: theme, layout, connection status.
 */

/** Running totals for the current trip. */
export interface TripState {
  /** Distance covered, km. */
  readonly distanceKm: number;
  /** Elapsed duration, s. */
  readonly durationS: number;
  /** Average speed, km/h. */
  readonly averageKmh: number;
  /** Fuel used, L. */
  readonly litresUsed: number;
  /** Average consumption, L/100 km. `null` until the car has moved. */
  readonly averagePer100km: number | null;
}

const EMPTY_TRIP: TripState = {
  distanceKm: 0,
  durationS: 0,
  averageKmh: 0,
  litresUsed: 0,
  averagePer100km: null,
};

export interface TelemetrySnapshot {
  readonly frame: TelemetryFrame;
  readonly trip: TripState;
}

export type SnapshotListener = (snapshot: TelemetrySnapshot) => void;

export class TelemetryStore {
  #snapshot: TelemetrySnapshot = { frame: EMPTY_FRAME, trip: EMPTY_TRIP };
  /** Value subscribers: called back when the snapshot changes. */
  #listeners = new Set<SnapshotListener>();
  /** Animation subscribers: called back on every frame. */
  #frameListeners = new Set<SnapshotListener>();
  /** Last snapshot actually delivered to value subscribers. */
  #distributed: TelemetrySnapshot | null = null;
  #rafId: number | null = null;
  #lastTimestamp: number | null = null;

  get current(): TelemetrySnapshot {
    return this.#snapshot;
  }

  /** Records a new frame and updates the trip totals. */
  push(frame: TelemetryFrame): void {
    this.#snapshot = { frame, trip: this.#integrateTrip(frame) };
  }

  /** Resets the trip without interrupting the session. */
  resetTrip(): void {
    this.#lastTimestamp = null;
    this.#snapshot = { frame: this.#snapshot.frame, trip: EMPTY_TRIP };
  }

  /**
   * Subscribes a tile, which is responsible for mutating its own DOM.
   *
   * The callback only fires when the snapshot has changed. The screen refreshes at 60 Hz while the
   * adapter publishes at 10: five frames in six would otherwise rewrite identical values, and
   * dirtying a node forces the browser to recompute style and layout for the whole tile.
   *
   * A fresh frame always yields a fresh object, so identity comparison suffices.
   */
  subscribe(listener: SnapshotListener): () => void {
    this.#listeners.add(listener);
    // Immediate: a tile that has just appeared must not stay empty waiting for the next frame.
    listener(this.#snapshot);
    this.#startLoop();

    return () => {
      this.#listeners.delete(listener);
      this.#stopIfIdle();
    };
  }

  /**
   * Subscribes what animates rather than what displays.
   *
   * The avatar interpolates between frames and uses this callback as its clock: driving it from
   * changes would drop it to the adapter's rate, a visible stutter. It needs every frame, even when
   * nothing has moved.
   */
  subscribeFrames(listener: SnapshotListener): () => void {
    this.#frameListeners.add(listener);
    this.#startLoop();

    return () => {
      this.#frameListeners.delete(listener);
      this.#stopIfIdle();
    };
  }

  #integrateTrip(frame: TelemetryFrame): TripState {
    const previous = this.#snapshot.trip;
    const last = this.#lastTimestamp;
    this.#lastTimestamp = frame.timestamp;

    if (last === null) return previous;

    // Clamped: a backgrounded tab would produce a huge delta and skew the distance at once.
    const dt = Math.min(Math.max((frame.timestamp - last) / 1000, 0), 5);
    if (dt === 0) return previous;

    const speed = frame.speed ?? 0;
    const litresPerHour = fuelRateLitresPerHour(frame) ?? 0;

    const distanceKm = previous.distanceKm + (speed / 3600) * dt;
    const durationS = previous.durationS + dt;
    const litresUsed = previous.litresUsed + (litresPerHour / 3600) * dt;

    return {
      distanceKm,
      durationS,
      litresUsed,
      averageKmh: durationS > 0 ? (distanceKm / durationS) * 3600 : 0,
      // Under 100 m the average is meaningless: show nothing.
      averagePer100km: distanceKm > 0.1 ? (litresUsed / distanceKm) * 100 : null,
    };
  }

  #startLoop(): void {
    if (this.#rafId !== null) return;
    const loop = (): void => {
      const snapshot = this.#snapshot;

      if (snapshot !== this.#distributed) {
        this.#distributed = snapshot;
        for (const listener of this.#listeners) listener(snapshot);
      }

      for (const listener of this.#frameListeners) listener(snapshot);
      this.#rafId = requestAnimationFrame(loop);
    };
    this.#rafId = requestAnimationFrame(loop);
  }

  #stopIfIdle(): void {
    if (this.#listeners.size > 0 || this.#frameListeners.size > 0) return;
    if (this.#rafId === null) return;
    cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
    // Without this, a subscriber arriving after a pause would see the loop skip the first round,
    // the current snapshot counting as already delivered.
    this.#distributed = null;
  }
}
