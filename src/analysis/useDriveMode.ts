import { useEffect, useState } from 'react';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import {
  buildSignature,
  classifyMode,
  toCalibrationSample,
  USABLE_SPREAD,
  type CalibrationSample,
} from '../obd/calibration';
import type { VehicleCalibration } from '../profiles/types';
import { DriveModeTracker, type DriveMode } from './driveMode';

/**
 * Sampling period. One point per second is ample for a 60 s window; sampling per frame would add
 * 600 samples without changing the result.
 */
const SAMPLE_MS = 1000;

/** Seconds of behaviour compared against the calibrated signatures. */
const WINDOW_S = 60;

/**
 * Tracks the driving mode while a source is streaming.
 *
 * Two ways of answering, and the better one is only available on a calibrated car. Where the driver
 * has driven each mode in turn, the current behaviour is compared against what was measured on THIS
 * car - which is the only method that works, since almost nothing reports the selector position.
 * Everywhere else the generic tracker infers from thresholds, as it always did.
 *
 * Driven by a timer rather than the store subscription, which is served by the animation loop and
 * stops when the page is hidden - a phone screen switches off while the car is still moving.
 */
export function useDriveMode(
  store: TelemetryStore,
  redline: number,
  active: boolean,
  calibration: VehicleCalibration | null = null,
): DriveMode {
  const [mode, setMode] = useState<DriveMode>('normal');

  // Signatures too alike cannot be told apart afterwards. Falling back to the generic tracker beats
  // announcing a mode drawn from noise, since the whole ambience follows it.
  const calibrated =
    calibration !== null &&
    calibration.signatures.length >= 2 &&
    (calibration.spread ?? 0) >= USABLE_SPREAD;

  useEffect(() => {
    if (!active) return;

    const tracker = new DriveModeTracker();
    const window_: CalibrationSample[] = [];

    const timer = window.setInterval(() => {
      const snapshot = store.current;

      if (!calibrated || calibration === null) {
        tracker.observe(snapshot, redline);
        setMode(tracker.mode);
        return;
      }

      window_.push(toCalibrationSample(snapshot.frame));
      if (window_.length > WINDOW_S) window_.shift();

      const live = buildSignature('', window_);
      const verdict = classifyMode(live, calibration.signatures);
      // Nothing decided means the car is between the modes it was calibrated for, or has not been
      // driven enough yet. Holding the last answer beats flickering through the ambiences.
      if (verdict !== null) setMode(verdict.mode);
    }, SAMPLE_MS);

    return () => window.clearInterval(timer);
  }, [store, redline, active, calibrated, calibration]);

  return mode;
}
