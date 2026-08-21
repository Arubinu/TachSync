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
 *
 * The hook is `onNeedReload`, and that detail is the whole thing working.
 *
 * With `registerType: 'autoUpdate'` the plugin reloads the window ITSELF the moment an updated
 * worker activates. `onNeedRefresh` is never called in that mode, and the function it returns does
 * nothing - so an earlier version of this file held a flag no one read while the page reloaded
 * underneath it. `onNeedReload` is the one hook that mode offers: supplied, the plugin hands the
 * decision over instead of reloading. Which also means the reload has to be issued here.
 */

let held = false;
let pending = false;

registerSW({
  immediate: true,
  onNeedReload() {
    pending = true;
    if (!held) applyPending();
  },
});

function applyPending(): void {
  if (!pending) return;
  pending = false;
  /*
   * The updated worker already controls the page by the time this runs - it declared
   * `skipWaiting` and claimed its clients. Reloading is only how the page catches up with the
   * worker already serving it, which is why deferring is safe: the wait costs a version mismatch
   * between the running code and its cache, never a broken page.
   *
   * `globalThis.location` rather than `window.location`: this module is imported by the test
   * runner, which has no window, and an optional call there is quieter than a guard.
   */
  globalThis.location?.reload();
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
