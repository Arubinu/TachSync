import { useEffect } from 'react';

/**
 * Keeps the screen lit while the dashboard is open.
 *
 * A gauge is read at a glance and never touched while driving, so the idle
 * timer fires exactly when the display matters most. The native application
 * settles this with a window flag; in a browser the Screen Wake Lock API is the
 * only lever, and it comes with two constraints worth stating.
 *
 * The lock is dropped by the browser as soon as the page is hidden — switching
 * tabs, locking the phone — and is **not** restored on return, hence the
 * re-request on `visibilitychange`. And it may simply be refused: unsupported
 * browser, insecure context, battery saver. That is not a failure to report;
 * the screen just dims as it normally would.
 */
export function useWakeLock(): void {
  useEffect(() => {
    const api = navigator.wakeLock;
    if (api === undefined) return;

    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = (): void => {
      if (stopped || sentinel !== null || document.visibilityState !== 'visible') return;

      api.request('screen').then(
        (granted) => {
          // The component may have unmounted while the request was in flight.
          // A sentinel nobody holds would keep the screen lit indefinitely.
          if (stopped) {
            void granted.release();
            return;
          }
          sentinel = granted;
          granted.addEventListener('release', () => {
            sentinel = null;
          });
        },
        () => {
          // Refused: nothing to do, and nothing worth telling the user.
        },
      );
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
      sentinel = null;
    };
  }, []);
}
