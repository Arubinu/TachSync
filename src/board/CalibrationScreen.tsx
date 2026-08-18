import { useEffect, useRef, useState } from 'react';
import { Calibration, suggestedRanges, type CalibrationResult } from '../obd/calibrationRun';
import { toCalibrationSample, USABLE_SPREAD } from '../obd/calibration';
import { DRIVE_MODES, type DriveMode } from '../analysis/driveMode';
import { format, useTranslation } from '../i18n';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import type { VehicleCalibration, VehicleRanges } from '../profiles/types';
import { CheckIcon } from './icons';
import { Sentences } from './Sentences';

export interface CalibrationScreenProps {
  readonly store: TelemetryStore;
  readonly vehicleLabel: string;
  readonly ranges: VehicleRanges;
  readonly onApply: (calibration: VehicleCalibration, ranges: VehicleRanges) => void;
  readonly onExport: (result: CalibrationResult<DriveMode>) => void;
  readonly onClose: () => void;
}

/** How often the screen redraws its progress. The measurements sample far faster. */
const TICK_MS = 500;

/**
 * Teaching the dashboard this particular car.
 *
 * Built to look like the screen the application opens on, because it belongs to the same moment:
 * something is being set up before driving properly begins. Same halo, same rhythm - a settings
 * page would have made a ten-minute drive feel like paperwork.
 *
 * The progression is deliberately game-like, and not for decoration. A protocol carried out at the
 * wheel needs to say, without being read closely, where it is and whether the current step counts:
 * hence one instruction at a time in large type, a ring that fills, and a step that visibly locks
 * in. What a driver must not do is study a screen.
 */
export function CalibrationScreen({
  store,
  vehicleLabel,
  ranges,
  onApply,
  onExport,
  onClose,
}: CalibrationScreenProps): React.JSX.Element {
  const t = useTranslation();
  const [modes, setModes] = useState<readonly DriveMode[] | null>(null);
  const run = useRef<Calibration<DriveMode> | null>(null);
  // Bumped by the timer: the calibration lives in a ref, so nothing else would ever redraw.
  const [, redraw] = useState(0);
  const [result, setResult] = useState<CalibrationResult<DriveMode> | null>(null);

  useEffect(() => {
    if (modes === null || result !== null) return;

    const calibration = run.current ?? new Calibration<DriveMode>(modes);
    run.current = calibration;

    const unsubscribe = store.subscribe((snapshot) => {
      calibration.observe(toCalibrationSample(snapshot.frame));
    });
    const timer = window.setInterval(() => redraw((n) => n + 1), TICK_MS);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [modes, result, store]);

  /* ---------- 1. which modes does this car have ---------- */

  if (modes === null) {
    return (
      <Frame title={t.calibration.title} subtitle={vehicleLabel} onClose={onClose}>
        <p className="calib__lead">
          <Sentences text={t.calibration.declareModes} />
        </p>

        <div className="calib__modes">
          {DRIVE_MODES.map((mode) => (
            <ModeToggle key={mode} mode={mode} label={t.driveModes[mode]} />
          ))}
        </div>

        <p className="calib__note">
          <Sentences text={t.calibration.noModesHint} />
        </p>
        <p className="calib__law">
          <Sentences text={t.roadRules} />
        </p>

        <div className="calib__actions">
          <button type="button" className="calib__primary" onClick={() => setModes(picked())}>
            {t.calibration.start}
          </button>
        </div>
      </Frame>
    );
  }

  /* ---------- 2. the protocol ---------- */

  const calibration = run.current;

  if (result === null && calibration !== null && !calibration.done) {
    const phase = calibration.phase;
    const progress = calibration.progress;
    const step = calibration.index + 1;

    return (
      <Frame title={t.calibration.title} subtitle={vehicleLabel} onClose={onClose}>
        <ol className="calib__track" aria-hidden>
          {calibration.phases.map((each, i) => (
            <li
              key={`${each.kind}-${each.mode ?? ''}`}
              className={
                i < calibration.index
                  ? 'calib__bead calib__bead--done'
                  : i === calibration.index
                    ? 'calib__bead calib__bead--live'
                    : 'calib__bead'
              }
            >
              {i < calibration.index ? <CheckIcon /> : null}
            </li>
          ))}
        </ol>

        <Ring ratio={progress.ratio} satisfied={progress.satisfied} />

        <p className="calib__step">
          {format(t.calibration.stepOf, { index: step, total: calibration.total })}
        </p>
        <h2 className="calib__instruction">
          {phase.mode === null
            ? t.calibration.phases[phase.kind]
            : format(t.calibration.driveInMode, { mode: t.driveModes[phase.mode] })}
        </h2>
        {phase.kind !== 'done' && (
          <p className="calib__note">
            <Sentences text={t.calibration.hints[phase.kind]} />
          </p>
        )}
        {/* Kept on screen for the driving phases, which are the ones that happen on a road. */}
        {phase.kind === 'drive' && (
          <p className="calib__law">
            <Sentences text={t.roadRules} />
          </p>
        )}

        <div className="calib__actions">
          <button
            type="button"
            className={progress.satisfied ? 'calib__primary' : 'calib__ghost'}
            onClick={() => {
              calibration.next();
              if (calibration.done) setResult(calibration.result());
              else redraw((n) => n + 1);
            }}
          >
            {progress.satisfied ? t.calibration.next : t.calibration.skip}
          </button>
        </div>
      </Frame>
    );
  }

  /* ---------- 3. what was learned ---------- */

  const found = result ?? calibration?.result() ?? null;
  if (found === null) return <Frame title={t.calibration.title} onClose={onClose} />;

  const offer = suggestedRanges(found, ranges);
  const tooClose = found.spread !== null && found.spread < USABLE_SPREAD;

  return (
    <Frame title={t.calibration.done} subtitle={vehicleLabel} onClose={onClose}>
      <dl className="calib__sheet">
        <Finding label={t.calibration.idle} value={found.idleRpm} unit="rpm" />
        <Finding
          label={t.calibration.redline}
          value={offer.redline}
          unit="rpm"
          note={offer.redlineMeasured ? t.calibration.measured : t.calibration.inferred}
        />
        <Finding label={t.calibration.topSpeed} value={offer.speed} unit="km/h" />
        <Finding
          label={t.calibration.turbo}
          value={found.turbo === null ? null : found.turbo ? t.calibration.yes : t.calibration.no}
        />
        <Finding
          label={t.calibration.modesLearned}
          value={found.signatures.length === 0 ? null : found.signatures.length}
        />
      </dl>

      {tooClose && (
        <p className="calib__warn">
          <Sentences text={t.calibration.modesTooClose} />
        </p>
      )}

      <div className="calib__actions">
        <button type="button" className="calib__ghost" onClick={() => onExport(found)}>
          {t.calibration.export}
        </button>
        <button
          type="button"
          className="calib__primary"
          onClick={() =>
            onApply(
              {
                modes,
                signatures: found.signatures,
                idleRpm: found.idleRpm,
                turbo: found.turbo,
                redlineMeasured: offer.redlineMeasured,
                spread: found.spread,
                at: new Date().toISOString(),
              },
              { speed: offer.speed, redline: offer.redline },
            )
          }
        >
          {t.calibration.apply}
        </button>
      </div>
    </Frame>
  );
}

/** Reads the ticked modes straight off the DOM: three checkboxes do not need a state each. */
function picked(): readonly DriveMode[] {
  const boxes = [...document.querySelectorAll<HTMLInputElement>('.calib__mode input:checked')];
  return boxes.map((box) => box.value as DriveMode);
}

function ModeToggle({ mode, label }: { readonly mode: DriveMode; readonly label: string }) {
  return (
    <label className="calib__mode">
      <input type="checkbox" value={mode} defaultChecked={false} />
      <span>{label}</span>
    </label>
  );
}

/**
 * The filling ring.
 *
 * A bar would have read as a wait; a ring reads as a target being filled, which is what the step
 * actually is. It turns to the accent only once the step counts, so the change of colour is the
 * signal - glanceable from the wheel without reading a word.
 */
function Ring({ ratio, satisfied }: { readonly ratio: number; readonly satisfied: boolean }) {
  const size = 132;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <svg
      className={satisfied ? 'calib__ring calib__ring--full' : 'calib__ring'}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle className="calib__ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <circle
        className="calib__ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(Math.max(ratio, 0), 1))}
      />
      <text className="calib__ring-text" x="50%" y="50%">
        {Math.round(Math.min(ratio, 1) * 100)}%
      </text>
    </svg>
  );
}

function Finding({
  label,
  value,
  unit,
  note,
}: {
  readonly label: string;
  readonly value: string | number | null;
  readonly unit?: string;
  readonly note?: string;
}) {
  const t = useTranslation();
  return (
    <div className="calib__finding">
      <dt>{label}</dt>
      <dd>
        {value === null ? (
          <span className="calib__unknown">{t.calibration.notMeasured}</span>
        ) : (
          <>
            {value}
            {unit !== undefined && <span className="calib__unit">{unit}</span>}
            {note !== undefined && <span className="calib__tag">{note}</span>}
          </>
        )}
      </dd>
    </div>
  );
}

function Frame({
  title,
  subtitle,
  onClose,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly children?: React.ReactNode;
}) {
  const t = useTranslation();
  return (
    <section className="calib" aria-label={title}>
      <button
        type="button"
        className="calib__close"
        onClick={onClose}
        aria-label={t.settings.close}
      >
        ✕
      </button>

      <header className="calib__head">
        <h1 className="calib__title">{title}</h1>
        {subtitle !== undefined && <p className="calib__subtitle">{subtitle}</p>}
      </header>

      <div className="calib__body">{children}</div>
    </section>
  );
}
