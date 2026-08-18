export interface PickerOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /**
   * Label for the collapsed field, when it differs.
   *
   * In the list the section heading already gives the context; once collapsed that context is gone
   * and has to be reintroduced, otherwise one reads "Default" without knowing default of what.
   */
  readonly collapsedLabel?: string;
}

export interface PickerGroup<T extends string> {
  readonly label: string;
  readonly options: readonly PickerOption<T>[];
}

/**
 * In-house pickers, expanded by the window hosting them.
 *
 * A native `<select>` opens the system picker: convenient, but it clashes with the rest of the
 * screen and obeys no theme. Here the list appears as one more level inside the current window,
 * which gives wide targets - welcome under a finger in a car - without ever stacking two surfaces
 * where it becomes unclear which one closes.
 */

export interface SelectFieldProps<T extends string> {
  readonly label: string;
  readonly value: T;
  /**
   * Choices organised into sections. A section with an empty label shows no heading - useful for
   * isolating an entry at the top of the list.
   */
  readonly groups: readonly PickerGroup<T>[];
  readonly onChange: (value: T) => void;
  /**
   * Control placed to the right of the chooser, on the same line.
   *
   * For what acts on the collection being chosen from rather than on the choice - importing into
   * it, emptying it. Kept out of the list itself, which must stay a list of choices: an entry that
   * did something instead of selecting something would be a trap in a moving car.
   */
  readonly trailing?: React.ReactNode;
  /**
   * Delegates displaying the list to whoever hosts the field.
   *
   * The field expands nothing itself: it announces what there is to choose, and the containing
   * window shows the list as one more level. A full-screen panel appearing over a modal would stack
   * two surfaces, and it would no longer be clear which one is being closed.
   */
  readonly onOpen: (request: PickerRequest) => void;
}

/** What a field passes to whoever takes over displaying its list. */
export interface PickerRequest {
  readonly label: string;
  readonly value: string;
  readonly groups: readonly PickerGroup<string>[];
  readonly onChange: (value: string) => void;
}

/**
 * The list alone, without its shell. Extracted so the settings can place it in their own window
 * without rewriting option rendering, or risking the two diverging.
 */
export function PickerList({
  groups,
  value,
  onChange,
}: {
  readonly groups: readonly PickerGroup<string>[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <>
      {groups.map((group, index) => (
        <section
          key={group.label === '' ? `group-${index}` : group.label}
          className="picker__group"
        >
          {group.label !== '' && <h4 className="picker__legend">{group.label}</h4>}
          <ul className="picker">
            {group.options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className={option.value === value ? 'picker__item is-selected' : 'picker__item'}
                  onClick={() => onChange(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <span className="picker__check" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/**
 * The checkbox list alone, without its shell.
 *
 * Counterpart to `PickerList` for a multiple choice. It never has a collapsed field: the few
 * filters using it open from a header button, and the filter state reads on that button rather than
 * in a numeric summary like "3 selected", which does not say which.
 *
 * The "all" entry is not one more checkbox but the absence of a filter: ticking it clears the
 * selection. That is why it presents as a list choice rather than a box beside the others.
 */
export function MultiPickerList<T extends string>({
  values,
  groups,
  allLabel,
  onChange,
}: {
  readonly values: readonly T[];
  readonly groups: readonly PickerGroup<T>[];
  readonly allLabel: string;
  readonly onChange: (values: readonly T[]) => void;
}): React.JSX.Element {
  function toggle(value: T): void {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <>
      <ul className="picker">
        <li>
          <button
            type="button"
            className={values.length === 0 ? 'picker__item is-selected' : 'picker__item'}
            onClick={() => onChange([])}
          >
            <span>{allLabel}</span>
            {values.length === 0 && (
              <span className="picker__check" aria-hidden>
                ✓
              </span>
            )}
          </button>
        </li>
      </ul>

      {groups.map((group) => (
        <fieldset key={group.label} className="picker__group">
          <legend>{group.label}</legend>
          {group.options.map((option) => (
            <label key={option.value} className="picker__item picker__item--check">
              <input
                type="checkbox"
                className="checkbox"
                checked={values.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  groups,
  onChange,
  onOpen,
  trailing,
}: SelectFieldProps<T>): React.JSX.Element {
  const current = groups
    .flatMap((group) => group.options)
    .find((option) => option.value === value);

  function request(): void {
    onOpen({
      label,
      value,
      groups: groups as readonly PickerGroup<string>[],
      onChange: (next) => onChange(next as T),
    });
  }

  const trigger = (
    <button type="button" className="field__trigger" onClick={request}>
      <span>{current?.collapsedLabel ?? current?.label ?? '—'}</span>
      <span className="field__caret" aria-hidden>
        ▾
      </span>
    </button>
  );

  return (
    <div className="field">
      <span className="field__label">{label}</span>

      {/* The row only exists when something has to share the line; every other field keeps the
          markup it always had. */}
      {trailing === undefined ? (
        trigger
      ) : (
        <div className="field__row">
          {trigger}
          {trailing}
        </div>
      )}
    </div>
  );
}

