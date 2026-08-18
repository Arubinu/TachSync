/**
 * OBD-II adapter discovery.
 *
 * How an adapter is found depends heavily on the platform:
 *
 * - Android application. A native plugin scans and returns a list we display ourselves. This is the
 * only case where a real list exists. - Browser. Web Bluetooth forbids enumerating devices: the
 * page can only open the browser's chooser, which shows its own list, and receives only the device
 * the user picked. This is deliberate - otherwise any site could inventory its visitors' Bluetooth.
 * No workaround exists and none should be sought.
 *
 * The connect screen adapts rather than promising the same thing everywhere: a list where one is
 * possible, a chooser button otherwise, and an explanation when nothing is possible.
 */

/** An adapter, as it can be displayed before connecting to it. */
export interface ObdDevice {
  readonly id: string;
  readonly name: string;
  /** Received signal strength, dBm. Absent when the platform does not provide it. */
  readonly rssi?: number;
}

export type DiscoveryMode =
  /** Scanning possible: we display our own list. */
  | 'scan'
  /** Browser chooser: a button, no list. */
  | 'chooser'
  /** Nothing is possible; `reason` says why. */
  | 'unavailable';

/**
 * Reason for unavailability.
 *
 * A translation KEY, not a message: this module is pure and testable, and has no business knowing
 * the interface language. The screen translates.
 */
export type DiscoveryReason =
  | 'insecureContext'
  | 'webView'
  | 'unsupportedBrowser'
  | 'nativePending';

export interface DiscoveryCapability {
  readonly mode: DiscoveryMode;
  readonly reason: DiscoveryReason | null;
}

/**
 * What the current environment allows.
 *
 * The causes of unavailability are distinguished because they call for different actions: an
 * insecure context is fixed by changing address, a WebView by installing the application, a browser
 * without Web Bluetooth by changing browser. A single message would leave the user with nothing to
 * try.
 */
export function detectDiscovery(
  scope: {
    readonly bluetooth?: unknown;
    readonly isSecureContext?: boolean;
    readonly userAgent?: string;
    /** True inside our own native shell, false in a browser. */
    readonly isNativeShell?: boolean;
  } = {},
  hasNativePlugin = false,
): DiscoveryCapability {
  if (hasNativePlugin) return { mode: 'scan', reason: null };

  if (scope.isSecureContext === false) {
    return { mode: 'unavailable', reason: 'insecureContext' };
  }

  if (scope.bluetooth === undefined || scope.bluetooth === null) {
    // Our own application, whose native bridge is not wired up yet. It is an Android WebView, but
    // advising the user to install the application would mean installing what is already open.
    if (scope.isNativeShell === true) {
      return { mode: 'unavailable', reason: 'nativePending' };
    }

    // Android's WebView does not expose Web Bluetooth and will not: that is the very reason the
    // native application exists.
    if (isAndroidWebView(scope.userAgent ?? '')) {
      return { mode: 'unavailable', reason: 'webView' };
    }
    return { mode: 'unavailable', reason: 'unsupportedBrowser' };
  }

  return { mode: 'chooser', reason: null };
}

/**
 * Recognises our native shell.
 *
 * Capacitor puts this object on the window; no browser does. Read here rather than imported from
 * `@capacitor/core` so the module stays usable - and testable - without the native dependency.
 */
export function isNativeShell(): boolean {
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

/**
 * Recognises an Android WebView.
 *
 * It announces itself with `; wv)` in its user agent - Chrome never carries it. The marker is crude
 * but it is the one the system provides.
 */
function isAndroidWebView(userAgent: string): boolean {
  return /\bwv\b/.test(userAgent) && /Android/.test(userAgent);
}

/** Source of adapters, whatever the platform. */
export interface ObdDiscovery {
  readonly capability: DiscoveryCapability;
  /** Starts a scan. Each device found is notified once, without duplicates. */
  scan(onFound: (device: ObdDevice) => void): Promise<void>;
  stopScan(): Promise<void>;
  /** Opens the browser's chooser. Returns the chosen device, or `null`. */
  request(): Promise<ObdDevice | null>;
}
