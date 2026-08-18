import { useEffect, useRef, useState } from 'react';
import { DEFAULT_RANGES } from '../profiles/types';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import { MoodTracker } from './mood';
import { findAvatar } from './registry';
import { useTranslation } from '../i18n';
import { AvatarError, type AvatarErrorCode } from './types';
import type { AvatarInstance, AvatarPalette } from './types';

export interface AvatarStageProps {
  readonly store: TelemetryStore;
  readonly avatarId: string;
  readonly palette: AvatarPalette;
  /** Flips the avatar horizontally. */
  readonly mirrored: boolean;
  /**
   * Vehicle redline, used to scale engine speed. Without it every engine would be judged alike:
   * 4000 rpm is nothing on an engine revving to 8000, and the end of the world on a diesel.
   */
  readonly redline?: number;
  /**
   * How far this driver's ordinary sits from the average, or 0 to judge against the average.
   *
   * Supplied by the board, which is where the trip history lives; the avatar only forwards it.
   */
  readonly baselineShift?: number;
}

/**
 * Mounts the selected avatar and feeds it.
 *
 * Driven from the store subscription, which already runs at display rate: no second animation loop,
 * and no React render while driving.
 *
 * Mounting is asynchronous (engine import, then reading the stored file). Failure is surfaced
 * rather than swallowed: an imported avatar that will not open leaves an empty frame otherwise, and
 * nothing to act on.
 */
export function AvatarStage({
  store,
  avatarId,
  palette,
  mirrored,
  redline = DEFAULT_RANGES.redline,
  baselineShift = 0,
}: AvatarStageProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<AvatarInstance | null>(null);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  // By reference: changing vehicle must not remount the avatar, which would reload its model and
  // lose its current mood.
  const redlineRef = useRef(redline);
  redlineRef.current = redline;

  // By reference, like the redline: a new baseline must not remount the avatar and reload its
  // model. The tracker is told directly instead.
  const shiftRef = useRef(baselineShift);
  shiftRef.current = baselineShift;

  const t = useTranslation();
  /*
   * The code, not the sentence.
   *
   * Resolved below, at render: keeping the sentence here would freeze it in the language of
   * the moment it failed, and would force `t` into the mount effect - remounting the avatar,
   * and reloading its model, on every language change.
   */
  const [error, setError] = useState<AvatarErrorCode | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    // Mounting can complete after an avatar change or an unmount; without this flag an orphan
    // instance would keep drawing.
    let cancelled = false;
    let instance: AvatarInstance | null = null;
    let unsubscribe: (() => void) | null = null;
    let observer: ResizeObserver | null = null;

    setError(null);

    void findAvatar(avatarId)
      .mount(container, paletteRef.current)
      .then((mounted) => {
        if (cancelled) {
          mounted.dispose();
          return;
        }

        instance = mounted;
        instanceRef.current = mounted;
        const tracker = new MoodTracker();
        tracker.setBaselineShift(shiftRef.current);

        observer = new ResizeObserver(([entry]) => {
          if (entry === undefined) return;
          const { width, height } = entry.contentRect;
          mounted.resize(width, height);
        });
        observer.observe(container);
        mounted.resize(container.clientWidth, container.clientHeight);

        let last = performance.now();
        // Per frame, not per telemetry sample: this is the animation clock.
        unsubscribe = store.subscribeFrames((snapshot) => {
          const now = performance.now();
          // Clamped: a tab returning to the foreground would produce a huge step and jump the
          // animation.
          const dt = Math.min((now - last) / 1000, 0.1);
          last = now;
          mounted.update(tracker.feed(snapshot, dt, redlineRef.current), dt);
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof AvatarError ? cause.code : 'unreadableAvatarFile');
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      observer?.disconnect();
      instance?.dispose();
      instanceRef.current = null;
    };
  }, [avatarId, store]);

  // Theme change: repaint without rebuilding.
  useEffect(() => {
    instanceRef.current?.setPalette(palette);
  }, [palette]);

  return (
    <div className="avatar-stage">
      {/*
        Mirroring is applied to the container rather than to each avatar, so one CSS transform
        flips a WebGL canvas and a vector drawing alike.
      */}
      <div
        ref={containerRef}
        className={mirrored ? 'avatar-stage__mount is-mirrored' : 'avatar-stage__mount'}
      />
      {error !== null && <p className="avatar-stage__error">{t.errors[error]}</p>}
    </div>
  );
}
