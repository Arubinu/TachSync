import { useEffect, useState } from 'react';
import type { ConnectionStatus, DataSource } from '../telemetry/DataSource';
import { EMPTY_FRAME, type TelemetryFrame } from '../telemetry/types';

/**
 * Subscribes a component to a telemetry source.
 *
 * This hook triggers a React render on every frame (~10 Hz). Acceptable for the diagnostic screen;
 * the board instead pushes values through refs written from the store subscription, without going
 * through React state.
 */
export function useDataSource(source: DataSource): {
  frame: TelemetryFrame;
  status: ConnectionStatus;
} {
  const [frame, setFrame] = useState<TelemetryFrame>(EMPTY_FRAME);
  const [status, setStatus] = useState<ConnectionStatus>(() => source.getStatus());

  useEffect(() => {
    const unsubscribeFrame = source.onFrame(setFrame);
    const unsubscribeStatus = source.onStatusChange(setStatus);
    void source.connect();

    return () => {
      unsubscribeFrame();
      unsubscribeStatus();
      void source.disconnect();
    };
  }, [source]);

  return { frame, status };
}
