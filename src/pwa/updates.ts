import { registerSW } from 'virtual:pwa-register';

/**
 * Service worker registration, and when a new version is allowed to take over.
 *
 * Applying an update reloads the page. That is harmless on a desk and unacceptable at the wheel:
 * reloading drops the Bluetooth link to the adapter, and Web Bluetooth cannot reconnect without a
 * user gesture - the dashboard would go dead until the driver picked the adapter again by hand.
 * The trip survives (checkpointed every 20 s) but the drive would not.
 *
 * A pending update is therefore held while a source is streaming and applied as soon as it stops.
 * Nothing is lost if the application closes first: the waiting worker activates on the next launch
 * by itself.
 */

let held = false;
let pending = false;

const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    pending = true;
    if (!held) applyPending();
  },
});

function applyPending(): void {
  if (!pending) return;
  pending = false;
  void applyUpdate(true);
}

/**
 * Holds pending updates while the dashboard is live.
 *
 * Called with the connection state: an update that arrives during a drive waits for the source to
 * stop rather than reloading underneath it.
 */
export function holdUpdates(hold: boolean): void {
  held = hold;
  if (!hold) applyPending();
}
