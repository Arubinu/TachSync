import { useEffect, useState } from 'react';
import {
  detectDiscovery,
  isNativeShell,
  type DiscoveryCapability,
  type ObdDevice,
} from '../obd/discovery';
import { useHoldToArm } from '../hooks/useHoldToArm';
import { Sentences } from './Sentences';
import { PersonIcon } from './icons';

/** Press duration that arms a recorded session. */
const CAPTURE_HOLD_MS = 5000;
import { useTranslation, type LanguageCode } from '../i18n';

/**
 * Adapter list entry.
 *
 * A short press connects, a five-second press connects while RECORDING: the gesture hides a rare
 * action - preparing a trace for development - behind the common one, without adding a button
 * nobody would use day to day.
 */
function DeviceButton({
  device,
  onConnect,
  onCapture,
}: {
  readonly device: ObdDevice;
  readonly onConnect: () => void;
  readonly onCapture: () => void;
}): React.JSX.Element {
  const hold = useHoldToArm(onConnect, onCapture, CAPTURE_HOLD_MS);

  return (
    <button
      type="button"
      className={hold.holding ? 'connect__device is-holding' : 'connect__device'}
      // Progress tints the button itself: over five seconds an indicator placed elsewhere would not
      // be looked at.
      style={{ '--hold': hold.progress } as React.CSSProperties}
      {...hold.handlers}
    >
      <span className="connect__device-name">{device.name}</span>
      {device.rssi !== undefined && (
        <span className="connect__device-signal">{device.rssi} dBm</span>
      )}
    </button>
  );
}

export interface ConnectScreenProps {
  readonly language: LanguageCode;
  /** Moves to the next language, wrapping around. */
  readonly onCycleLanguage: () => void;
  /** Starts a scan. Returns the stop function. */
  readonly onScan?: (onFound: (device: ObdDevice) => void) => Promise<() => void>;
  /** Opens the browser's chooser. */
  readonly onRequest?: () => Promise<ObdDevice | null>;
  /**
   * `capture` asks for a recorded session: the transport is wrapped and the guided assistant opens.
   * Armed by a long press on the adapter.
   */
  readonly onConnect: (device: ObdDevice, options?: { readonly capture: boolean }) => void;
  readonly onSimulate: () => void;
  /** Forced in tests; detected from the environment otherwise. */
  readonly capability?: DiscoveryCapability;
  /**
   * Who is getting in, and into what.
   *
   * Shown rather than asked: nine launches in ten it is the same person in the same car, and a
   * question with a constant answer gets dismissed unread. The state is visible and changed with a
   * tap if needed.
   */
  readonly identity?: {
    readonly person: string;
    readonly vehicle: string;
    readonly onEdit: () => void;
  };
}

/**
 * Connect screen: where the data comes from.
 *
 * Two layouts, decided in CSS alone - the component does not know the orientation:
 *
 * - Portrait: logo at the top, everything else pinned to the bottom, where the thumb naturally
 * falls on a one-handed phone. - Landscape: logo and explanation left, source choice right.
 * Stacking vertically on a wide screen would leave two empty bands at the sides and push the button
 * out of reach.
 *
 * The choice section changes nature with the platform - see `detectDiscovery`.
 */
export function ConnectScreen({
  language,
  onCycleLanguage,
  onScan,
  onRequest,
  onConnect,
  onSimulate,
  capability,
  identity,
}: ConnectScreenProps): React.JSX.Element {
  const t = useTranslation();
  const [discovery] = useState<DiscoveryCapability>(
    () =>
      capability ??
      detectDiscovery({
        bluetooth: (navigator as { bluetooth?: unknown }).bluetooth,
        isSecureContext: window.isSecureContext,
        userAgent: navigator.userAgent,
        isNativeShell: isNativeShell(),
      }),
  );

  const [devices, setDevices] = useState<readonly ObdDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scanning starts on its own: arriving on this screen is already searching.
  useEffect(() => {
    if (discovery.mode !== 'scan' || onScan === undefined) return;

    let stop: (() => void) | null = null;
    let cancelled = false;

    setScanning(true);
    onScan((device) => {
      // A scan sees the same device several times a second: without this filter the list would fill
      // with duplicates.
      setDevices((current) =>
        current.some((known) => known.id === device.id) ? current : [...current, device],
      );
    })
      .then((stopScan) => {
        if (cancelled) stopScan();
        else stop = stopScan;
      })
      .catch((cause: unknown) => {
        setScanning(false);
        setError(cause instanceof Error ? cause.message : t.connect.scanFailed);
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [discovery.mode, onScan]);

  async function chooseDevice(): Promise<void> {
    if (onRequest === undefined) return;
    setError(null);
    try {
      const device = await onRequest();
      if (device !== null) onConnect(device);
    } catch (cause: unknown) {
      // A user cancelling is not a failure: do not alarm them.
      const message = cause instanceof Error ? cause.message : '';
      if (!/cancel|annul/i.test(message)) setError(message || t.connect.selectionInterrupted);
    }
  }

  /**
   * Title and explanation.
   *
   * A sibling of the choice panel rather than its child: in landscape it files under the logo on
   * the left while the panel moves right, which nesting would make impossible in CSS alone.
   */
  const caption = (
    <div className="connect__legend">
      <h1 className="connect__title">
        {discovery.mode === 'scan' && t.connect.nearbyAdapters}
        {discovery.mode === 'chooser' && t.connect.obdAdapter}
        {discovery.mode === 'unavailable' && t.connect.bluetoothUnavailable}
        {scanning && (
          <span className="connect__spinner" aria-label={t.connect.searchInProgress} />
        )}
      </h1>

      {discovery.mode === 'chooser' && (
        <p className="connect__hint">
          <Sentences text={t.connect.chooserHint} />
        </p>
      )}
      {discovery.reason !== null && (
        <p className="connect__hint">{t.discovery[discovery.reason]}</p>
      )}
      {error !== null && <p className="connect__error">{error}</p>}
    </div>
  );

  return (
    <div className="connect">
      {/*
        Top right corner: one press, the next language. The two-letter code fits a touch target
        without translating its own label - a dropdown here would demand reading a language one may
        not yet understand.
      */}
      <button
        type="button"
        className="connect__language"
        onClick={onCycleLanguage}
        aria-label={t.connect.changeLanguage}
        title={t.languageName}
      >
        {language.toUpperCase()}
      </button>

      <div className="connect__brand">
        <img className="connect__logo" src={`${import.meta.env.BASE_URL}logo-mark.png`} alt="TachSync" />

        {identity !== undefined && (
          <button
            type="button"
            className="connect__identity"
            onClick={identity.onEdit}
            title={t.settings.profiles}
          >
            <PersonIcon />
            <span className="connect__identity-name">{identity.person}</span>
            <span className="connect__identity-sep" aria-hidden>
              •
            </span>
            <span className="connect__identity-name">{identity.vehicle}</span>
          </button>
        )}
      </div>

      {caption}

      <div className="connect__choices">
        {discovery.mode === 'scan' &&
          (devices.length === 0 ? (
            <p className="connect__hint">
              {scanning ? t.connect.searching : t.connect.noAdapter}
            </p>
          ) : (
            <ul className="connect__list">
              {devices.map((device) => (
                <li key={device.id}>
                  <DeviceButton
                    device={device}
                    onConnect={() => onConnect(device)}
                    onCapture={() => onConnect(device, { capture: true })}
                  />
                </li>
              ))}
            </ul>
          ))}

        {discovery.mode === 'chooser' && (
          <button type="button" className="connect__action" onClick={() => void chooseDevice()}>
            {t.connect.chooseAdapter}
          </button>
        )}

        <button type="button" className="connect__simulate" onClick={onSimulate}>
          {t.connect.continueWithout}
          <span className="connect__simulate-note">{t.connect.simulatedData}</span>
        </button>
      </div>
    </div>
  );
}
