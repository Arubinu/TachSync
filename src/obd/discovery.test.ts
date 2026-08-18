import { describe, expect, it } from 'vitest';
import { detectDiscovery } from './discovery';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const WEBVIEW_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36';

describe('discovery capability', () => {
  it('scans when the native plugin is there', () => {
    expect(detectDiscovery({}, true)).toEqual({ mode: 'scan', reason: null });
  });

  it('opens the browser chooser when Web Bluetooth exists', () => {
    const capability = detectDiscovery({
      bluetooth: {},
      isSecureContext: true,
      userAgent: CHROME_ANDROID,
    });

    expect(capability.mode).toBe('chooser');
  });

  it('explains that an insecure connection blocks everything', () => {
    const capability = detectDiscovery({ bluetooth: {}, isSecureContext: false });

    expect(capability.mode).toBe('unavailable');
    expect(capability.reason).toBe('insecureContext');
  });

  it('tells an Android embedded view apart', () => {
    const capability = detectDiscovery({ isSecureContext: true, userAgent: WEBVIEW_ANDROID });

    expect(capability.mode).toBe('unavailable');
    // The useful action is not the same as for a browser lacking the API.
    expect(capability.reason).toBe('webView');
  });

  it('does not advise installing the application to someone already running it', () => {
    // Our native shell is an Android WebView: without this distinction it received "install the
    // application", displayed inside the application. Observed on the emulator, never locally.
    const capability = detectDiscovery({
      isSecureContext: true,
      userAgent: WEBVIEW_ANDROID,
      isNativeShell: true,
    });

    expect(capability.mode).toBe('unavailable');
    expect(capability.reason).toBe('nativePending');
  });

  it('hands back to the native bridge as soon as it is plugged in', () => {
    const capability = detectDiscovery(
      { isSecureContext: true, userAgent: WEBVIEW_ANDROID, isNativeShell: true },
      true,
    );

    expect(capability.mode).toBe('scan');
    expect(capability.reason).toBeNull();
  });

  it('tells apart a browser with no Bluetooth support', () => {
    const capability = detectDiscovery({
      isSecureContext: true,
      userAgent: 'Mozilla/5.0 (Macintosh) Safari/605.1',
    });

    expect(capability.mode).toBe('unavailable');
    expect(capability.reason).toBe('unsupportedBrowser');
  });

  it('prefers the native plugin even inside an embedded view', () => {
    // Exactly the Android application's situation: an embedded view without Web Bluetooth, but with
    // a native plugin available.
    expect(detectDiscovery({ userAgent: WEBVIEW_ANDROID }, true).mode).toBe('scan');
  });
});
