import { useCallback, useEffect, useRef } from 'react';
import { DEFAULT_RANGES, type VehicleRanges } from '../profiles/types';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import type { MetricId } from './layout';
import { METRIC_SPECS } from './tiles';

/**
 * Publishes a tile's metrics as CSS variables.
 *
 * Without this a value only exists as text: CSS can neither rotate a needle, nor fill a dial, nor
 * turn red past a threshold. That is exactly what separates a styled tile from a real instrument,
 * and it costs nothing - the tile already writes into its DOM each frame, this just adds a few
 * properties.
 *
 * For each of the tile's metrics:
 *
 * --<metric> raw value, in its display unit --<metric>-ratio same value mapped to 0..1, when it has
 * a scale --<metric>-known 1 if the vehicle supplies it, 0 otherwise
 *
 * The primary metric is mirrored as `--value`, `--ratio` and `--known`, so a generic template works
 * without knowing which metric it shows.
 */
export function useTileVariables(
  store: TelemetryStore,
  metrics: readonly MetricId[],
  /**
   * Vehicle full-scale values, for the ratios exposed to imported dressings. Defaulted outside the
   * board, where no car is involved.
   */
  ranges: VehicleRanges = DEFAULT_RANGES,
): (node: HTMLElement | null) => void {
  const nodeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return store.subscribe((snapshot) => {
      const node = nodeRef.current;
      if (node === null) return;

      metrics.forEach((metric, index) => {
        const spec = METRIC_SPECS[metric as keyof typeof METRIC_SPECS] as
          | (typeof METRIC_SPECS)[keyof typeof METRIC_SPECS]
          | undefined;
        if (spec === undefined) return;

        const value = spec.extract(snapshot);
        const known = value === null ? 0 : 1;
        // A missing metric is 0 rather than nothing: a `calc()` over an empty variable would
        // invalidate the whole declaration, and the designer would see their styling vanish without
        // understanding why.
        const raw = value ?? 0;
        const ratio =
          value === null || spec.ratio === undefined ? 0 : clamp01(spec.ratio(value, ranges));

        write(node, metric, raw, ratio, known);
        if (index === 0) write(node, null, raw, ratio, known);
      });
    });
  }, [metrics, store]);

  return useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);
}

/** `metric === null` writes the generic set for the primary metric. */
function write(
  node: HTMLElement,
  metric: MetricId | null,
  raw: number,
  ratio: number,
  known: number,
): void {
  node.style.setProperty(metric === null ? '--value' : `--${metric}`, raw.toFixed(3));
  node.style.setProperty(metric === null ? '--ratio' : `--${metric}-ratio`, ratio.toFixed(4));
  node.style.setProperty(metric === null ? '--known' : `--${metric}-known`, String(known));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
