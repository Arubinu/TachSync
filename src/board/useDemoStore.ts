import { useEffect, useMemo } from 'react';
import { SimulatedSource } from '../simulation/SimulatedSource';
import { TelemetryStore } from '../telemetry/TelemetryStore';

/**
 * Demo source for previews.
 *
 * Independent of the real source: a preview must stay meaningful with the car stopped, where every
 * value would be flat. The sporty profile moves the gauges firmly, which a frozen thumbnail would
 * not show.
 */
export function useDemoStore(): TelemetryStore {
  const store = useMemo(() => new TelemetryStore(), []);

  useEffect(() => {
    const source = new SimulatedSource({ profile: 'sporty', frequencyHz: 10, seed: 11 });
    const unsubscribe = source.onFrame((frame) => store.push(frame));
    void source.connect();

    return () => {
      unsubscribe();
      void source.disconnect();
    };
  }, [store]);

  return store;
}
