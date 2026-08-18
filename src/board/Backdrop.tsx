import type { TelemetryStore } from '../telemetry/TelemetryStore';
import { ALL_METRICS, type BackgroundPreset } from './layout';
import { TileTemplate } from './TileTemplate';
import { useTileVariables } from './tileVariables';

export interface BackdropProps {
  readonly background: BackgroundPreset | null;
  readonly store: TelemetryStore;
}

/**
 * Imported background.
 *
 * Fills the screen behind the grid without ever capturing a finger. The theme background stays
 * painted on the document; this one lays over it, which lets a translucent imported background
 * compose with it rather than erase it.
 *
 * It can react to driving just as a tile does: the telemetry variables are published at its root,
 * and it accepts the same declarative structure. A designer can therefore offer a living decor, not
 * just an image.
 */
export function Backdrop({ background, store }: BackdropProps): React.JSX.Element | null {
  // Every metric, not just a few: a decor has no primary metric, and its author must be free to
  // pick.
  const setVariablesRef = useTileVariables(store, ALL_METRICS);

  if (background === null) return null;

  return (
    <div className="backdrop" data-background={background.id} ref={setVariablesRef} aria-hidden>
      {background.layout !== null && <TileTemplate nodes={background.layout} store={store} />}
    </div>
  );
}
