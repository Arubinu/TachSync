import { useTranslation } from '../i18n';
import type { LanguageCode } from '../i18n';
import { Sentences } from './Sentences';

export interface TermsScreenProps {
  readonly language: LanguageCode;
  readonly onCycleLanguage: () => void;
  readonly onAccept: () => void;
}

/**
 * What the application is, and what it is not, before anything else.
 *
 * Shown once, ahead of the adapter screen, and remembered afterwards. Ahead rather than behind:
 * accepting the terms of a dashboard once it is already showing figures would be a formality, and
 * the point here is that it is read.
 *
 * Borrows the connect screen's ground so it reads as the first page of the same thing rather than
 * an interstitial. Same halo, same language selector in the same corner - the terms have to be
 * legible in a language one actually reads, which means being able to change it from here.
 *
 * No checkbox before the button. A tick that arms an action teaches people to tick without reading;
 * a single button that says what it means costs one gesture and claims nothing false.
 */
export function TermsScreen({
  language,
  onCycleLanguage,
  onAccept,
}: TermsScreenProps): React.JSX.Element {
  const t = useTranslation();

  return (
    <div className="connect terms">
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
      </div>

      <div className="terms__body">
        <h1 className="terms__title">{t.terms.title}</h1>
        <p className="terms__lead">
          <Sentences text={t.terms.lead} />
        </p>

        <ul className="terms__list">
          {[t.terms.driver, t.terms.law, t.terms.attention, t.terms.noWarranty].map((line) => (
            <li key={line}>
              <Sentences text={line} />
            </li>
          ))}
        </ul>
      </div>

      <div className="terms__actions">
        <button type="button" className="terms__accept" onClick={onAccept}>
          {t.terms.accept}
        </button>
      </div>
    </div>
  );
}
