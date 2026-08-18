import { useState } from 'react';
import { advance, captureState, CAPTURE_STEPS } from '../obd/capture';
import { format, useTranslation } from '../i18n';
import type { Translation } from '../i18n';

export interface CaptureGuideProps {
  /** Writes a timestamped marker into the log. Supplied by the recorder. */
  readonly onMark: (stepId: string) => void;
  readonly onExport: () => void;
  readonly onClose: () => void;
}

/**
 * Guided capture assistant.
 *
 * One button, held by a passenger: pressing writes a marker timestamped to the millisecond at the
 * moment the step begins, and shows the next instruction. Noting timings by hand while driving does
 * not work - they are forgotten and approximated, and the trace becomes useless exactly where it
 * mattered.
 *
 * The target fills all available width and height: it must be found without being looked at, and
 * nothing else must be touchable by accident.
 */
export function CaptureGuide({ onMark, onExport, onClose }: CaptureGuideProps): React.JSX.Element {
  const t = useTranslation();
  const [index, setIndex] = useState(0);
  const state = captureState(index);

  function nextStep(): void {
    const current = CAPTURE_STEPS[index];
    // The marker carries the step that begins, never the one being left: it is the instant of the
    // gesture that interests the trace, not its end.
    if (current !== undefined) onMark(current.id);
    setIndex(advance(index));
  }

  return (
    <section className="capture" aria-label={t.capture.title}>
      <header className="capture__head">
        <h2 className="capture__title">{t.capture.title}</h2>
        <button type="button" className="capture__close" onClick={onClose} aria-label={t.settings.close}>
          ✕
        </button>
      </header>

      {state.done ? (
        <div className="capture__body">
          <p className="capture__instruction">{t.capture.done}</p>
          <button type="button" className="capture__action" onClick={onExport}>
            {t.capture.export}
          </button>
        </div>
      ) : (
        <>
          <p className="capture__progress">
            {format(t.capture.progress, { index: state.index, total: state.total })}
          </p>
          <p className="capture__instruction">{stepText(state.step?.id ?? '', t)}</p>
          <p className="capture__safety">{t.capture.safety}</p>

          {/*
            Full surface: at the wheel, a target that has to be aimed at is a target that gets
            missed.
          */}
          <button type="button" className="capture__tap" onClick={nextStep}>
            {state.index === state.total ? t.capture.finish : t.capture.next}
          </button>
        </>
      )}
    </section>
  );
}

/**
 * A step's instruction.
 *
 * The log writes the id, the screen shows the instruction: a trace stays readable by someone who
 * does not speak the language of whoever produced it.
 */
function stepText(id: string, t: Translation): string {
  const steps = t.capture.steps as Record<string, string | undefined>;
  return steps[id] ?? '';
}
