import { useEffect, useState } from 'react';
import { avatarLabel, findAvatar } from '../avatar/registry';
import type { AvatarLibrary } from '../avatar/useAvatars';
import type { AvatarPalette } from '../avatar/types';
import { AvatarStage } from '../avatar/AvatarStage';
import { wouldEmptyAvatar } from '../avatar/hidden';
import { useDemoStore } from './useDemoStore';
import { BACKUP_EXTENSION } from './backup';
import type { DrivingProfile } from '../simulation/driver';
import { DRIVING_PROFILES } from '../simulation/driver';
import { VEHICLE_PRESETS, type VehicleSpec } from '../simulation/vehicle';
import { findTheme, THEMES } from '../theme/themes';
import { themeBackgroundId } from './backgrounds';
import { WALLPAPER_ID, type StoredWallpaper } from './wallpaper';
import {
  CalibrateIcon,
  CheckIcon,
  ChevronIcon,
  EditIcon,
  ImportIcon,
  LookIcon,
  PersonIcon,
  DropperIcon,
  EyeIcon,
  SwapIcon,
  TrashIcon,
  VehicleIcon,
  WarningIcon,
} from './icons';
import { Modal } from './Modal';
import { Tip, useTipMessage } from './Tip';
import { TripChart } from './TripChart';
import { REVEAL, useSwipeToDelete } from '../hooks/useSwipeToDelete';
import { readTrace, weightOf, type TripTrace } from '../trips/trace';
import { PickerList, SelectField, type PickerGroup, type PickerRequest } from './Picker';
import { clampFontScale, FONT_SCALE_STEP, type AppSettings, type Orientation } from './layout';
import { CATALOGUES, format, nextLanguage, useTranslation, type Translation } from '../i18n';
import type { LanguageCode } from '../i18n';
import { activeVehicle } from '../profiles/state';
import { flattenForExport } from '../profiles/layouts';
import type { VehiclePhoto } from '../profiles/photo';
import { MIN_TRIPS, readBaseline } from '../analysis/baseline';
import { Sentences } from './Sentences';
import type { VehicleCalibration, VehicleRanges } from '../profiles/types';
import { USABLE_SPREAD, type ModeSignature } from '../obd/calibration';
import { redlineFromPeak } from '../obd/calibrationRun';
import type { DriveMode } from '../analysis/driveMode';
import { byteSize, tripDate, tripFigures } from '../trips/format';
import { ProfilesSection } from './ProfilesSection';
import { TransferPanel } from './TransferPanel';
import { addEntity, entityLabel } from '../profiles/actions';
import { activePerson, activeAppearance } from '../profiles/state';
import type { ProfileState } from '../profiles/state';
import type { ProfileKind } from '../profiles/actions';
import type { TripRecord } from '../trips/types';

type SectionId =
  | 'profiles'
  | 'person'
  | 'calibration'
  | 'vehicleProfile'
  | 'look'
  | 'appearance'
  | 'avatar'
  | 'simulator'
  | 'board'
  | 'trips'
  | 'imports'
  | 'backup';

/**
 * Rail entries, in the order they are walked.
 *
 * What is set once first - the look, the character - then what is adjusted while driving, then
 * administration. A pause menu is read top to bottom, and order is the only hierarchy available.
 */
function sectionKey(id: SectionId): keyof Translation['settings'] {
  return SECTIONS.find((entry) => entry.id === id)?.key ?? 'title';
}

const SECTIONS: ReadonlyArray<{ id: SectionId; key: keyof Translation['settings'] }> = [
  // Outside the menu but in the table: it is what titles each level, and the three identity
  // sections need it like the others.
  { id: 'profiles', key: 'profiles' },
  { id: 'person', key: 'person' },
  { id: 'vehicleProfile', key: 'vehicleProfile' },
  { id: 'look', key: 'look' },
  // First: what is adjusted most often, and where editing is entered from.
  { id: 'board', key: 'board' },
  { id: 'appearance', key: 'appearance' },
  { id: 'avatar', key: 'avatar' },
  { id: 'simulator', key: 'simulator' },
  { id: 'calibration', key: 'calibration' },
  { id: 'trips', key: 'trips' },
  { id: 'imports', key: 'imports' },
  { id: 'backup', key: 'backup' },
];

export interface SettingsPanelProps {
  readonly settings: AppSettings;
  readonly profile: DrivingProfile;
  readonly vehicle: VehicleSpec;
  readonly onChange: (settings: AppSettings) => void;
  readonly onProfileChange: (profile: DrivingProfile) => void;
  readonly onVehicleChange: (vehicle: VehicleSpec) => void;
  readonly onResetTrip: () => void;
  /** Trip history, most recent first. */
  readonly trips: readonly TripRecord[];
  readonly onClearTrips: () => void;
  /** Removes one trip and its curves. */
  readonly onDeleteTrip: (id: string) => void;
  /** The profile collections, and the means to administer them. */
  readonly profiles: ProfileState;
  readonly onProfilesChange: (state: ProfileState) => void;
  /** Resizes the grid of a named orientation, not the current one. */
  readonly onGridChange: (
    orientation: Orientation,
    columnsDelta: number,
    rowsDelta: number,
  ) => void;
  readonly onDeletePack: (pack: string) => void;
  readonly onExport: () => void;
  readonly onImportSettings: (file: File) => void;
  /** Available avatars, and the means to add or remove them. */
  readonly library: AvatarLibrary;
  /** The active car's photograph, so exporting it can carry it. */
  readonly vehiclePhoto: VehiclePhoto | null;
  /** Stores a photograph that arrived in a vehicle file, against the id just assigned to it. */
  readonly onAdoptPhoto: (vehicleId: string, photo: File) => void;
  /** The imported background image, or `null`. Its presence decides what the button does. */
  readonly wallpaper: StoredWallpaper | null;
  readonly onImportWallpaper: (file: File) => void;
  readonly onRemoveWallpaper: () => void;
  /** Why the last image was refused, if it was. Shown as a bubble, like every other refusal. */
  readonly wallpaperReport: string | null;
  /** Changes on every answer, so the same refusal twice shows twice. */
  readonly wallpaperReportId: number;
  /** Moves to the next or previous avatar, resolved against the freshest state. */
  readonly onCycleAvatar: (direction: 1 | -1) => void;
  /**
   * Which source is streaming, or `null` before one is chosen.
   *
   * Decides which settings are worth showing at all.
   */
  readonly source: 'simulated' | 'obd' | null;
  /**
   * Starts a calibration, or `null` when none is possible.
   *
   * `null` while no source is streaming: the protocol measures a running car, and an entry that
   * opened onto a screen with nothing to read would be worse than no entry.
   */
  readonly onCalibrate: (() => void) | null;
  /** Report from the last restore. */
  readonly settingsReport: string | null;
  /** Changes on every answer, so the same words twice show twice. */
  readonly settingsReportId: number;
  readonly onClose: () => void;
}

/**
 * Groups backgrounds into sections, one per theme.
 *
 * Each theme opens its section with the background it supplies itself, followed by any an import
 * attached to it. What was designed to go together is visible at a glance, instead of a flat list
 * mixing imported decors with original themes.
 */
function backgroundGroups(
  settings: AppSettings,
  wallpaper: StoredWallpaper | null,
  t: Translation,
): PickerGroup<string>[] {
  /**
   * In the list the theme name would be redundant, the section already carrying it. Collapsed, the
   * field loses that context - hence the extended label.
   */
  const toOption = (
    background: (typeof settings.backgrounds)[number],
    themeLabel: string | null,
  ): PickerGroup<string>['options'][number] => {
    const name =
      background.pack === null ? background.label : `${background.label} — ${background.pack}`;
    return themeLabel === null
      ? { value: background.id, label: name }
      : { value: background.id, label: name, collapsedLabel: `${themeLabel} — ${background.label}` };
  };

  const themed = THEMES.map((theme) => ({
    label: theme.label,
    options: [
      {
        value: themeBackgroundId(theme.id),
        label: t.settings.defaultBackground,
        collapsedLabel: `${theme.label} — ${t.settings.defaultBackground.toLowerCase()}`,
      },
      ...settings.backgrounds
        .filter((item) => item.themeId === theme.id)
        .map((item) => toOption(item, theme.label)),
    ],
  }));

  const orphans = settings.backgrounds.filter(
    (item) => item.themeId === null || !THEMES.some((theme) => theme.id === item.themeId),
  );

  /*
   * The imported image, first: it is the one entry belonging to no theme.
   *
   * No file name and no heading - there is one image at a time, so naming it answers a question
   * that cannot arise, and a section title would repeat the single line under it.
   */
  const image: PickerGroup<string>[] =
    wallpaper === null
      ? []
      : [{ label: '', options: [{ value: WALLPAPER_ID, label: t.settings.importedImage }] }];

  return [
    ...image,
    ...themed,
    { label: t.settings.noTheme, options: orphans.map((item) => toOption(item, null)) },
  ].filter((group) => group.options.length > 0);
}

/**
 * The menu sections that administer a collection.
 *
 * A table rather than three branches: the three sections share one view and differ only in the
 * entity they govern.
 */
/**
 * The identity sections, reached from the header button.
 *
 * Outside the main menu: three administration entries at the top of the list weighed as much as the
 * settings opened every day, when they are visited once.
 */
const IDENTITY: readonly SectionId[] = ['person', 'vehicleProfile', 'look'];

/**
 * The two that move a configuration in or out. Kept together at the foot of the menu.
 */
const FILES: readonly SectionId[] = ['imports', 'backup'];

/** Which section is returned from, and where to. Absent means back to the main menu. */
const PARENT: Partial<Record<SectionId, SectionId>> = {
  person: 'profiles',
  vehicleProfile: 'profiles',
  look: 'profiles',
};

const PROFILE_KINDS: Partial<Record<SectionId, ProfileKind>> = {
  person: 'people',
  vehicleProfile: 'vehicles',
  look: 'appearances',
};

/** The face each list shows on its transfer panel: the same shape that led there. */
const KIND_ICON: Record<ProfileKind, React.JSX.Element> = {
  people: <PersonIcon />,
  vehicles: <VehicleIcon />,
  appearances: <LookIcon />,
};

const ORIENTATIONS: readonly Orientation[] = ['landscape', 'portrait'];

/** Stepper for one grid dimension, modelled on the scale control. */
function GridStepper({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (delta: number) => void;
}): React.JSX.Element {
  const t = useTranslation();

  return (
    <div className="grid-size__item">
      <span className="grid-size__label">{label}</span>
      <div className="scale">
        <button type="button" onClick={() => onChange(-1)} aria-label={t.editor.decrease}>
          −
        </button>
        <span className="scale__value">{value}</span>
        <button type="button" onClick={() => onChange(1)} aria-label={t.editor.increase}>
          +
        </button>
      </div>
    </div>
  );
}

/** Next profile, wrapping around. */
function nextProfile(current: DrivingProfile): DrivingProfile {
  const index = DRIVING_PROFILES.indexOf(current);
  return DRIVING_PROFILES[(index + 1) % DRIVING_PROFILES.length] ?? current;
}

/** Groups imported items by source file. */
function summarizePacks(
  settings: AppSettings,
): Array<{ name: string; tiles: number; backgrounds: number }> {
  const counts = new Map<string, { tiles: number; backgrounds: number }>();

  const bump = (pack: string | null, key: 'tiles' | 'backgrounds'): void => {
    if (pack === null) return;
    const entry = counts.get(pack) ?? { tiles: 0, backgrounds: 0 };
    entry[key] += 1;
    counts.set(pack, entry);
  };

  for (const preset of settings.presets) bump(preset.pack, 'tiles');
  for (const background of settings.backgrounds) bump(background.pack, 'backgrounds');

  return [...counts.entries()].map(([name, entry]) => ({ name, ...entry }));
}

/**
 * Settings, opened by a long press.
 *
 * Arranged as self-contained blocks that sit side by side as soon as there is width: what is seen
 * (appearance), what feeds the screen (simulator), what is acted on (board), and what has been
 * added (imports). Each setting carries its label and nothing more - the shape of the control
 * already says what it does.
 *
 * Backup stays apart, framed and last: it adjusts nothing, it moves the entire configuration in or
 * out.
 */
export function SettingsPanel({
  settings,
  profile,
  vehicle,
  onChange,
  onProfileChange,
  onVehicleChange,
  onResetTrip,
  trips,
  onClearTrips,
  onDeleteTrip,
  profiles,
  onProfilesChange,
  onGridChange,
  onDeletePack,
  onExport,
  vehiclePhoto,
  onAdoptPhoto,
  wallpaper,
  onImportWallpaper,
  onRemoveWallpaper,
  wallpaperReport,
  wallpaperReportId,
  onImportSettings,
  library,
  onCycleAvatar,
  source,
  onCalibrate,
  settingsReport,
  settingsReportId,
  onClose,
}: SettingsPanelProps): React.JSX.Element {
  const t = useTranslation();
  const packs = summarizePacks(settings);

  function changeScale(delta: number): void {
    onChange({ ...settings, fontScale: clampFontScale(settings.fontScale + delta * FONT_SCALE_STEP) });
  }

  // `null` is the menu itself. A chosen section replaces it, like a game pause: one level at a
  // time, and an explicit way back.
  const [section, setSection] = useState<SectionId | null>(null);
  // The transfer view replaces the list it was opened from, and closes with it.
  const [transferring, setTransferring] = useState(false);

  const profileKind: ProfileKind | null =
    section === null ? null : (PROFILE_KINDS[section] ?? null);

  // The entity the three lists are looking at, whichever list that is.
  // The same reading the board uses, shown here so the setting can say what it found.
  const baseline = readBaseline(trips, {
    id: activeVehicle(profiles).id,
    label: entityLabel(
      activeVehicle(profiles),
      profiles.vehicles.indexOf(activeVehicle(profiles)),
      t.settings.vehicleProfile,
    ),
  });

  const currentEntity =
    profileKind === 'people'
      ? activePerson(profiles)
      : profileKind === 'vehicles'
        ? // Flattened here rather than in the panel: the file carries the exporter's own grid, and
          // only this side knows who is driving.
          flattenForExport(activeVehicle(profiles), profiles.personId)
        : activeAppearance(profiles);

  /**
   * List currently being browsed, if any.
   *
   * A third level of the same menu rather than a full-screen panel over the window: two stacked
   * surfaces and it is no longer clear which one the back button closes.
   */
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  // One drawer open at a time, and one trip unfolded at a time: two curves at once turn a list
  // into a page to scroll, and two open drawers make it unclear which one a tap would empty.
  const [openedTrip, setOpenedTrip] = useState<string | null>(null);
  const [shownTrip, setShownTrip] = useState<string | null>(null);

  /*
   * Aiming at an object to hide it.
   *
   * A mode rather than a list of checkboxes: the pieces of a drawing have no names worth showing -
   * "earLeft", "panel" - and pointing at the thing is the only description that needs no glossary.
   *
   * Whether it is possible at all is answered by the mounted engine, not guessed from the file
   * type. Assumed true until it answers, so the button does not change appearance on every avatar
   * change before the engine has had its say.
   */
  const [picking, setPicking] = useState(false);
  const [pickingSupported, setPickingSupported] = useState(true);
  // What the mounted avatar is made of, so a hide that would empty it can be refused.
  const [pickableParts, setPickableParts] = useState<readonly string[]>([]);
  // What the mode has to say for itself: armed, or refused. A bubble rather than a line of text -
  // it answers the tap on the button, and has nothing to add once read.
  const pickingTip = useTipMessage();

  const hiddenParts = settings.hiddenAvatarParts[settings.avatarId] ?? [];

  /*
   * Aiming never outlives the screen it was armed on.
   *
   * Left running it would arm the next visit to a screen where nothing explains the crosshair; and
   * armed on an avatar that cannot be aimed at, it would leave the preview catching taps that name
   * nothing. Leaving the panel needs no rule: the component goes with it.
   */
  if (picking && (section !== 'avatar' || !pickingSupported)) setPicking(false);

  // Changing avatar ends it too, supported or not: the objects of the previous drawing are gone,
  // and carrying the mode over invites hiding a piece of a character one was only passing through.
  useEffect(() => {
    setPicking(false);
    // The bubble goes with the mode: "tap an object" left standing over a screen that no longer
    // listens is an instruction to do something that will not work.
    pickingTip.say(null);
  }, [settings.avatarId, pickingTip.say]);

  function hidePart(partId: string): void {
    const current = settings.hiddenAvatarParts[settings.avatarId] ?? [];
    if (current.includes(partId)) return;

    /*
     * The last object stays.
     *
     * Not for tidiness: an empty frame gives the tool nothing to aim at, so the gesture that
     * emptied it could not undo it. Refused with a word rather than silently, a tap that does
     * nothing reading as a fault.
     */
    if (wouldEmptyAvatar(pickableParts, current, partId)) {
      pickingTip.say(t.settings.hideObjectsLastOne);
      return;
    }

    onChange({
      ...settings,
      hiddenAvatarParts: {
        ...settings.hiddenAvatarParts,
        [settings.avatarId]: [...current, partId],
      },
    });
  }

  function showAllParts(): void {
    // The key is removed rather than emptied, so an untouched avatar leaves no trace in storage or
    // in a backup.
    const { [settings.avatarId]: _hidden, ...rest } = settings.hiddenAvatarParts;
    onChange({ ...settings, hiddenAvatarParts: rest });
  }

  /*
   * The eyedropper, and the way back from it.
   *
   * Named here rather than written into the header, because when both show they are wrapped
   * together - and a wrapper reads badly around an expression already three levels deep.
   */
  const dropperButton = (
    <button
      key="dropper"
      type="button"
      /*
       * Hatched rather than disabled when the avatar cannot be aimed at.
       *
       * Disabled, the button explained itself only through `title`, which no touch screen ever
       * shows - and it was also the trap: arming the mode, then stepping onto a Rive avatar, left
       * the only way out greyed under the finger. It stays live and answers instead.
       */
      className={[
        'modal__action',
        picking ? 'is-active' : '',
        pickingSupported ? '' : 'modal__action--unavailable',
      ]
        .filter((name) => name !== '')
        .join(' ')}
      onClick={() => {
        if (!pickingSupported) {
          pickingTip.say(t.settings.hideObjectsUnsupported);
          return;
        }
        const armed = !picking;
        setPicking(armed);
        // Said on arming, taken back on leaving: a bubble still standing after the mode ended
        // would be instructing nobody.
        pickingTip.say(armed ? t.settings.hideObjectsHint : null);
      }}
      aria-pressed={picking}
      aria-label={t.settings.hideObjects}
      title={pickingSupported ? t.settings.hideObjects : t.settings.hideObjectsUnsupported}
    >
      <DropperIcon />
    </button>
  );

  const showAllButton = (
    <button
      key="show-all"
      type="button"
      className="modal__action modal__action--inset"
      onClick={showAllParts}
      aria-label={t.settings.showAllObjects}
      title={t.settings.showAllObjects}
    >
      <EyeIcon />
    </button>
  );

  return (
    /**
     * A centred window, not a full-screen panel. The settings now fit in a short menu: filling the
     * screen for six entries erased the board for nothing.
     */
    <Modal
      // The title names the level: "Settings" at the menu, then the section. Repeating "Settings"
      // inside a subsection would teach nothing and leave the window silent about where one is.
      title={
        picker !== null
          ? picker.label
          : section === null
            ? t.settings.title
            : t.settings[sectionKey(section)]
      }
      onClose={onClose}
      /*
       * Editing is entered from the main settings page, beside the way out.
       *
       * By the cross rather than by back: both leave this window, and one of them leaves it FOR
       * something. Offered at the top level alone - deeper down one is adjusting a detail, not
       * deciding to rearrange the board.
       *
       * Dashed, so it does not read as a third equal button in a row of solid ones: what it opens
       * is a mode, not a screen.
       */
      trailing={
        section === null && picker === null
          ? [
              <button
                key="edit"
                type="button"
                className="modal__action modal__action--dashed"
                onClick={() => {
                  onChange({ ...settings, locked: !settings.locked });
                  // Closed at once: editing happens on the board, and the window must be gone
                  // before the first gesture.
                  onClose();
                }}
                aria-label={settings.locked ? t.settings.editMode : t.editBar.exitEditMode}
                title={settings.locked ? t.settings.editMode : t.editBar.exitEditMode}
              >
                {settings.locked ? <EditIcon /> : <CheckIcon />}
              </button>,
            ]
          : []
      }
      {...(picker !== null
        ? {}
        : profileKind !== null
          ? {
              actions: [
                <button
                  key="transfer"
                  type="button"
                  className={transferring ? 'modal__action is-active' : 'modal__action'}
                  onClick={() => setTransferring((on) => !on)}
                  aria-label={t.transfer.title}
                  aria-pressed={transferring}
                  title={t.transfer.title}
                >
                  <SwapIcon />
                </button>,
              ],
            }
          : section === 'avatar'
            ? {
                /*
                 * The eyedropper sits beside the way back, where the transfer button sits one
                 * section over: both turn the screen they are on into a mode, and the same corner
                 * for the same kind of thing.
                 *
                 * The same button leaves the mode, so aiming is never a trap - which is also why
                 * nothing here needs a confirm step.
                 */
                actions:
                  hiddenParts.length === 0
                    ? [dropperButton]
                    : [
                        /*
                         * One outline around the two.
                         *
                         * Undoing exists only because of the tool beside it, and a shared frame
                         * says so where two free-standing buttons would read as two instruments.
                         *
                         * A wrapper rather than a border grafted onto the second button: the fill
                         * and the dashes then belong to a single box, so the dashes meet as one
                         * run and the tool's rounded corner sits over a fill already there. Built
                         * from two elements, the seam showed - the dashes restarted, and two
                         * translucent fills stacked into a darker band along the join.
                         */
                        <span key="dropper-pair" className="modal__pair">
                          {dropperButton}
                          {showAllButton}
                        </span>,
                      ],
              }
            : {})}
      // Back goes up one step, never to the menu: from a list one returns to the section, not the
      // top.
      {...(picker !== null
        ? { onBack: () => setPicker(null) }
        : section !== null
          ? {
              onBack: transferring
                ? () => setTransferring(false)
                : () => setSection(PARENT[section] ?? null),
            }
          : {
              /**
               * The language button opens nothing: it cycles on click.
               *
               * Reduced to its two-letter code it fits in the header corner, where the back button
               * sits once a level down - because it is at the top, and only there, that the
               * language of everything else is chosen. The code rather than a flag or an icon: "DE"
               * is recognisable while the interface is still in a language one cannot read.
               */
              leading: (
                <>
                <button
                  type="button"
                  className="modal__action"
                  onClick={() => setSection('profiles')}
                  title={t.settings.profiles}
                  aria-label={t.settings.profiles}
                >
                  <PersonIcon />
                </button>

                <button
                  type="button"
                  className="modal__action modal__action--language"
                  onClick={() =>
                    onChange({ ...settings, language: nextLanguage(settings.language) })
                  }
                  title={CATALOGUES[settings.language].languageName}
                  aria-label={CATALOGUES[settings.language].languageName}
                >
                  {settings.language.toUpperCase()}
                </button>
                </>
              ),
            })}
    >
      {(
        <>
          <div className="pause">
            {/*
              Vertical menu, like a game pause.

              The settings used to fit in three columns shown at once: everything was visible, so
              nothing stood out, and each addition worsened the clutter. Two entries act directly,
              without opening a pane for a single setting.
            */}
            {picker !== null && (
              <div className="pause__panel">
                <PickerList
                  groups={picker.groups}
                  value={picker.value}
                  onChange={(next) => {
                    picker.onChange(next);
                    // Return where one came from: staying on the list after choosing would demand a
                    // second gesture for nothing.
                    setPicker(null);
                  }}
                />
              </div>
            )}

            {picker === null && section === null && (
            <nav className="pause__menu" aria-label={t.settings.title}>
              {SECTIONS.filter(
                (entry) =>
                  entry.id !== 'profiles' &&
                  !IDENTITY.includes(entry.id) &&
                  !FILES.includes(entry.id) &&
                  /*
                   * Each source hides what belongs to the other: calibrating needs a real car, and
                   * the simulator's own settings mean nothing while an adapter is feeding the
                   * board. Hidden rather than disabled - a control one cannot use teaches nothing
                   * by staying visible.
                   *
                   * A calibration already taken stays readable whatever is streaming: it is a
                   * record, not an action. Gating the record on the adapter hid a vehicle's own
                   * measurements from it the moment the adapter was unplugged.
                   */
                  (entry.id !== 'calibration' ||
                    onCalibrate !== null ||
                    activeVehicle(profiles).calibration !== null) &&
                  (entry.id !== 'simulator' || source === 'simulated'),
              ).map(
                (entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="pause__item"
                    onClick={() => setSection(entry.id)}
                  >
                    {t.settings[entry.key]}
                  </button>
                ),
              )}

              {/*
                The two that deal in files, together at the foot.

                They belong to the same errand - moving a configuration in or out - and neither is
                opened on an ordinary day. Side by side and set apart from the list, they stop
                competing with the settings one actually visits.
              */}
              <div className="pause__files">
                {SECTIONS.filter(
                  (entry) =>
                    FILES.includes(entry.id) && (entry.id !== 'imports' || packs.length > 0),
                ).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="pause__item"
                    onClick={() => setSection(entry.id)}
                  >
                    {t.settings[entry.key]}
                  </button>
                ))}
              </div>
            </nav>
            )}

            {picker === null && section !== null && (
            <div className="pause__panel">

            {section === 'profiles' && (
              <nav className="pause__menu" aria-label={t.settings.profiles}>
                {IDENTITY.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="pause__item"
                    onClick={() => setSection(id)}
                  >
                    {t.settings[sectionKey(id)]}
                  </button>
                ))}
              </nav>
            )}

            {profileKind !== null &&
              (transferring ? (
                <TransferPanel
                  kind={profileKind}
                  current={currentEntity}
                  label={entityLabel(
                    profiles[profileKind].find((item) => item.id === currentEntity.id) ??
                      currentEntity,
                    profiles[profileKind].findIndex((item) => item.id === currentEntity.id),
                    t.settings[
                      profileKind === 'people'
                        ? 'person'
                        : profileKind === 'vehicles'
                          ? 'vehicleProfile'
                          : 'look'
                    ],
                  )}
                  icon={KIND_ICON[profileKind]}
                  photo={profileKind === 'vehicles' ? vehiclePhoto : null}
                  onImport={(entity, photo) => {
                    const next = addEntity(profiles, profileKind, entity);
                    onProfilesChange(next);
                    // `addEntity` selects what it added, so the id to store the picture against is
                    // the one now active - there is no other way to learn it from here.
                    if (photo !== null && profileKind === 'vehicles') {
                      onAdoptPhoto(next.vehicleId, photo);
                    }
                  }}
                />
              ) : (
                <ProfilesSection
                  kind={profileKind}
                  state={profiles}
                  onChange={onProfilesChange}
                  onOpenPicker={setPicker}
                />
              ))}

            {section === 'appearance' && (
            <section className="settings__group">
              {/*
                A button that acts, like the language one: two states, with the current one written
                on it. A checkbox would have required reading its label to know what it does.
              */}
              <button
                type="button"
                className="pause__item pause__item--toggle"
                onClick={() => onChange({ ...settings, light: !settings.light })}
              >
                {settings.light ? t.settings.lightOn : t.settings.lightOff}
              </button>

              <SelectField
                label={t.settings.background}
                value={settings.backgroundId ?? themeBackgroundId(THEMES[0]?.id ?? '')}
                groups={backgroundGroups(settings, wallpaper, t)}
                onChange={(backgroundId) => onChange({ ...settings, backgroundId })}
                onOpen={setPicker}
                trailing={
                  wallpaper === null ? (
                    /* A label, not a button: only a `label` opens the file picker without script. */
                    <label
                      className="modal__action"
                      aria-label={t.settings.importBackground}
                      title={t.settings.importBackground}
                    >
                      <ImportIcon />
                      <input
                        type="file"
                        accept="image/*"
                        className="visually-hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file !== undefined) onImportWallpaper(file);
                          // Reset, so the same file can be chosen again after a removal.
                          event.target.value = '';
                        }}
                      />
                    </label>
                  ) : (
                    /*
                      One slot, two jobs: with an image in place there is nothing to import until
                      it is gone, and two icons side by side would have to be told apart at a
                      glance in a moving car.
                    */
                    <button
                      type="button"
                      className="modal__action modal__action--danger"
                      onClick={onRemoveWallpaper}
                      aria-label={t.settings.removeBackground}
                      title={t.settings.removeBackground}
                    >
                      <TrashIcon />
                    </button>
                  )
                }
              />

              <div className="field">
                <span className="field__label">{t.settings.textScale}</span>
                <div className="scale">
                  <button
                    type="button"
                    onClick={() => changeScale(-1)}
                    disabled={settings.fontScale <= 0.5}
                    aria-label={t.editor.decrease}
                  >
                    −
                  </button>
                  <span className="scale__value">{Math.round(settings.fontScale * 100)} %</span>
                  <button
                    type="button"
                    onClick={() => changeScale(1)}
                    disabled={settings.fontScale >= 2.5}
                    aria-label={t.editor.increase}
                  >
                    +
                  </button>
                </div>
              </div>
            </section>
            )}

            {section === 'avatar' && (
              <AvatarField
                currentId={settings.avatarId}
                library={library}
                onCycle={onCycleAvatar}
                palette={{
                  accent: findTheme(settings.themeId).colors.accent,
                  accentAlt: findTheme(settings.themeId).colors.accentAlt,
                }}
                picking={picking}
                hiddenParts={hiddenParts}
                onPick={hidePart}
                onPickingSupported={setPickingSupported}
                onPartsChange={setPickableParts}
              />
            )}

            {section === 'simulator' && (
              <section className="settings__group">

              <div className="field">
                <span className="field__label">{t.settings.drivingStyle}</span>
                {/*
                  Four mutually exclusive profiles: a cycling button suffices and holds a column's
                  width.
                */}
                <button
                  type="button"
                  className="cycle-button"
                  onClick={() => onProfileChange(nextProfile(profile))}
                >
                  {t.profiles[profile === 'sporty' ? 'sporty' : profile]}
                </button>
              </div>

              <SelectField
                label={t.settings.vehicle}
                value={vehicle.label}
                groups={[
                  {
                    label: '',
                    options: VEHICLE_PRESETS.map((candidate) => ({
                      value: candidate.label,
                      label: candidate.label,
                    })),
                  },
                ]}
                onChange={(label) => {
                  const next = VEHICLE_PRESETS.find((candidate) => candidate.label === label);
                  if (next !== undefined) onVehicleChange(next);
                }}
                onOpen={setPicker}
              />
              </section>
            )}

            {section === 'calibration' && (
              <div className="backup">
                {/*
                  Same arrangement as the backup section: what is to be read fills the space and is
                  centred, what acts stays at the foot under the thumb.
                */}
                <div className="backup__notice">
                  <CalibrateIcon />
                  <CalibrationSummary
                    calibration={activeVehicle(profiles).calibration}
                    language={settings.language}
                    ranges={activeVehicle(profiles).ranges}
                    trips={trips}
                    onAdoptRedline={(redline) => {
                      const target = activeVehicle(profiles).id;
                      onProfilesChange({
                        ...profiles,
                        vehicles: profiles.vehicles.map((vehicle) =>
                          vehicle.id === target
                            ? { ...vehicle, ranges: { ...vehicle.ranges, redline } }
                            : vehicle,
                        ),
                      });
                    }}
                  />
                </div>

                <div className="avatar-actions">
                  {onCalibrate !== null && (
                    <button type="button" className="chip" onClick={onCalibrate}>
                      {activeVehicle(profiles).calibration === null
                        ? t.calibration.openFromSettings
                        : t.calibration.recalibrate}
                    </button>
                  )}

                  {/*
                    Only where there is something to forget. Marked as destructive, because it is:
                    a calibration is a drive, and dropping one means driving it again.
                  */}
                  {activeVehicle(profiles).calibration !== null && (
                    <button
                      type="button"
                      className="chip chip--danger"
                      onClick={() => {
                        const target = activeVehicle(profiles).id;
                        onProfilesChange({
                          ...profiles,
                          vehicles: profiles.vehicles.map((vehicle) =>
                            vehicle.id === target ? { ...vehicle, calibration: null } : vehicle,
                          ),
                        });
                      }}
                    >
                      {t.calibration.forget}
                    </button>
                  )}
                </div>
              </div>
            )}

            {section === 'board' && (
              <section className="settings__group settings__group--filled">
                {/*
                  Both grids adjustable from here, including the orientation not currently held.

                  They used to live in the edit bar, which only knows the current orientation:
                  adjusting portrait meant turning the device, and therefore holding it while
                  counting columns.
                */}
                {ORIENTATIONS.map((target) => (
                  <div className="field" key={target}>
                    <span className="field__label">{t.settings[target]}</span>
                    <div className="grid-size">
                      <GridStepper
                        label={t.editBar.columns}
                        value={settings.layouts[target].columns}
                        onChange={(delta) => onGridChange(target, delta, 0)}
                      />
                      <GridStepper
                        label={t.editBar.rows}
                        value={settings.layouts[target].rows}
                        onChange={(delta) => onGridChange(target, 0, delta)}
                      />
                    </div>
                  </div>
                ))}


                {/*
                  Actions at the foot, detached from the dimensions.

                  Adjusting a grid and leaving the settings to edit are different in kind: mixed
                  into one stack, "Edit mode" got clicked while the user thought they were still
                  counting columns.
                */}
                <div className="board-actions">
                  {/*
                    One button that turns editing on or off, rather than one that disappears once
                    on. A control that vanishes leaves the question of whether something is missing;
                    a control that changes its wording answers it.
                  */}
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      onChange({ ...settings, locked: !settings.locked });
                      // Closed without an exit animation: editing starts, and the window must be
                      // gone before the first gesture.
                      onClose();
                    }}
                  >
                    {settings.locked ? t.settings.editMode : t.editBar.exitEditMode}
                  </button>

                  <button type="button" className="chip" onClick={onResetTrip}>
                    {t.settings.resetTrip}
                  </button>
                </div>
              </section>
            )}

            {section === 'imports' && packs.length > 0 && (
              <section className="settings__group">
                <ul className="layer-summary">
                  {packs.map((pack) => (
                    <li key={pack.name}>
                      <span>{pack.name}</span>
                      <span className="layer-summary__count">
                        {pack.tiles > 0 && `${pack.tiles} ${t.settings.tilesCount}`}
                        {pack.tiles > 0 && pack.backgrounds > 0 && ' · '}
                        {pack.backgrounds > 0 && `${pack.backgrounds} ${t.settings.backgroundsCount}`}
                      </span>
                      <button
                        type="button"
                        className="chip chip--danger"
                        onClick={() => onDeletePack(pack.name)}
                      >
                        {t.settings.delete}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {section === 'trips' && (
              <div className="trips">
                {/*
                  A log, not a map: the list says what was covered, not where. A route would need
                  the phone's GPS, which nothing uses yet.
                */}
                {trips.length === 0 ? (
                  <p className="trips__empty">{t.settings.noTrips}</p>
                ) : (
                  <ul className="trips__list">
                    {trips.map((trip) => (
                      <TripRow
                        key={trip.id}
                        trip={trip}
                        language={settings.language}
                        opened={openedTrip === trip.id}
                        onOpenedChange={(open) => setOpenedTrip(open ? trip.id : null)}
                        expanded={shownTrip === trip.id}
                        onToggle={() => {
                          setShownTrip(shownTrip === trip.id ? null : trip.id);
                          // The drawer folds away with the same tap. Left open beside the curves it
                          // would be an armed delete button under a finger that asked to read.
                          setOpenedTrip(null);
                        }}
                        onDelete={() => {
                          setOpenedTrip(null);
                          setShownTrip(null);
                          onDeleteTrip(trip.id);
                        }}
                      />
                    ))}
                  </ul>
                )}

                {/*
                  What the history is FOR, offered where the history is.

                  Off by default: it makes the readings personal, which is what makes them useful
                  and also what makes them incomparable with anyone else's. Switching it back off
                  restores the fixed thresholds exactly - nothing was rewritten, the trips are only
                  read.
                */}
                <div className="field trips__setting">
                  <span className="field__label">{t.settings.useTripHistory}</span>
                  <button
                    type="button"
                    className="cycle-button"
                    onClick={() => onChange({ ...settings, useTripHistory: !settings.useTripHistory })}
                    aria-pressed={settings.useTripHistory}
                  >
                    {settings.useTripHistory
                      ? t.settings.useTripHistoryOn
                      : t.settings.useTripHistoryOff}
                  </button>
                </div>

                {settings.useTripHistory && (
                  <p className="settings__hint trips__note">
                    <Sentences
                      text={
                        baseline === null
                          ? format(t.settings.baselineTooFew, { count: MIN_TRIPS })
                          : format(t.settings.baselineFrom, { count: baseline.trips })
                      }
                    />
                  </p>
                )}

                <div className="board-actions">
                  <button type="button" className="chip" onClick={onClearTrips}>
                    {t.settings.clearTrips}
                  </button>
                </div>
              </div>
            )}

            {section === 'backup' && (
              <div className="backup">
                {/*
                  The warning fills the space and the buttons stay at the foot, as in the avatar
                  section. An import replaces the whole configuration: it is the only action in the
                  panel that destroys anything, and it must be read before being reached, not
                  after.
                */}
                <div className="backup__notice">
                  <WarningIcon />
                  <p className="backup__warning">{t.settings.backupWarning}</p>
                </div>

                <div className="avatar-actions">
                  <button type="button" className="chip" onClick={onExport}>
                    {t.settings.export}
                  </button>

                  <label className="chip">
                    {t.settings.import}
                    <input
                      type="file"
                      accept={`.${BACKUP_EXTENSION}`}
                      className="visually-hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file !== undefined) onImportSettings(file);
                        // Reset so the same file can be imported again.
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
            </div>
            )}
          </div>
        </>
      )}

      {/*
        Outside the sections: the bubble answers the gesture, not the panel that received it, so it
        survives leaving the section - an answer is owed even to someone who has moved on.
      */}
      {pickingTip.text !== null && (
        <Tip key={`picking-${pickingTip.id}`} main={pickingTip.text} />
      )}
      {wallpaperReport !== null && <Tip key={wallpaperReportId} main={wallpaperReport} />}
      {settingsReport !== null && (
        <Tip key={`backup-${settingsReportId}`} main={settingsReport} />
      )}
    </Modal>
  );
}

interface AvatarFieldProps {
  readonly currentId: string;
  readonly library: AvatarLibrary;
  /**
   * Steps forward or back.
   *
   * A direction rather than a computed id: two quick presses would otherwise both start from the
   * same avatar - state not having been reapplied in between - and two taps would advance one step.
   * The parent resolves against the freshest state.
   */
  readonly onCycle: (direction: 1 | -1) => void;
  /** Active theme colours: the preview must show the avatar as it will be. */
  readonly palette: AvatarPalette;
  /** Aiming at an object rather than watching the avatar. */
  readonly picking: boolean;
  readonly hiddenParts: readonly string[];
  readonly onPick: (partId: string) => void;
  readonly onPickingSupported: (supported: boolean) => void;
  readonly onPartsChange: (parts: readonly string[]) => void;
}

/**
 * Avatar picker.
 *
 * Two arrows to browse and nothing else: avatars are tried one after another while watching the
 * result, which is the only way to judge anyway.
 *
 * The application ships only two, drawn in code and weighing a few kilobytes. The rest are
 * imported: a volumetric character runs to tens of megabytes.
 */
function AvatarField({
  currentId,
  library,
  onCycle,
  palette,
  picking,
  hiddenParts,
  onPick,
  onPickingSupported,
  onPartsChange,
}: AvatarFieldProps): React.JSX.Element {
  const t = useTranslation();
  const store = useDemoStore();
  const { avatars, report, reportId, importFile, remove } = library;
  const current = findAvatar(currentId);
  const position = avatars.findIndex((avatar) => avatar.id === current.id) + 1;

  return (
    <div className="field">
      {/*
        No heading here: the window title bar already says "Avatar".
      */}

      {/*
        The avatar for real, above its picker.

        Fed by the demo stream: frozen, it would not show what distinguishes two avatars, namely
        how they react. It is also the surface the eyedropper aims at, which is why the preview is
        here rather than reduced to a thumbnail.
      */}
      <div className="avatar-preview">
        <AvatarStage
          store={store}
          avatarId={currentId}
          palette={palette}
          mirrored={false}
          picking={picking}
          hiddenParts={hiddenParts}
          onPick={onPick}
          onPickingSupported={onPickingSupported}
          onPartsChange={onPartsChange}
        />
      </div>


      <div className="avatar-picker">
        <button
          type="button"
          className="avatar-picker__arrow"
          onClick={() => onCycle(-1)}
          aria-label={t.settings.previousAvatar}
        >
          <ChevronIcon direction="left" />
        </button>

        <span className="avatar-picker__current">
          <span className="avatar-picker__name">{avatarLabel(current, t)}</span>
          <span className="avatar-picker__meta">
            {position} / {avatars.length}
          </span>
        </span>

        <button
          type="button"
          className="avatar-picker__arrow"
          onClick={() => onCycle(1)}
          aria-label={t.settings.nextAvatar}
        >
          <ChevronIcon direction="right" />
        </button>

      </div>

      {/*
        The two actions under the frame, side by side, like the backup ones.

        The frame only selects; what is done with the selected avatar is decided below. An icon
        lodged between the arrows shared its target with browsing and read poorly.

        Only an imported avatar can be removed: the two built-ins are the floor the application can
        always fall back to.
      */}
      <div className="avatar-actions">
        <label className="chip">
          {t.settings.import}
          <input
            type="file"
            accept=".riv,.glb,.gltf"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void importFile(file);
              // Reset so the same file can be imported again.
              event.target.value = '';
            }}
          />
        </label>

        {current.imported === true && (
          <button
            type="button"
            className="chip chip--danger"
            onClick={() => {
              // Leave the avatar before erasing it: otherwise the setting would point at something
              // absent while the registry reloads.
              onCycle(1);
              void remove(current.id);
            }}
          >
            {t.settings.remove}
          </button>
        )}
      </div>

      {/* Floating, like every other answer to a gesture: it has nothing to add once read. */}
      {report !== null && <Tip key={reportId} main={report} />}
    </div>
  );
}

/**
 * What the last calibration found.
 *
 * Reports only; the way to run another sits at the foot of the section, where every other action in
 * this panel is. A calibration ages - tyres, season, a different fuel - so the date is the first
 * thing, before any of the figures.
 *
 * The redline carries where it came from. Measured against the limiter it is a fact; inferred from
 * the highest reading it is a floor, and the only one of the two worth correcting by hand in the
 * vehicle profile.
 */
function CalibrationSummary({
  calibration,
  language,
  ranges,
  trips,
  onAdoptRedline,
}: {
  readonly calibration: VehicleCalibration | null;
  readonly language: LanguageCode;
  readonly ranges: VehicleRanges;
  /** Every trip; what happened since the calibration is what makes it look its age. */
  readonly trips: readonly TripRecord[];
  /** Raises the redline to what the trips have seen. */
  readonly onAdoptRedline: (redline: number) => void;
}): React.JSX.Element {
  const t = useTranslation();

  if (calibration === null) return <p className="backup__warning">{t.calibration.never}</p>;

  /*
   * A calibration ages, and the trips are what show it.
   *
   * Two things are worth saying and neither is an error: how long ago it was run with how much
   * driving since, and whether the engine has been seen beyond the redline that was measured. The
   * second is the useful one - it means the figure was a floor, not a ceiling, which is exactly
   * what an inferred redline is.
   */
  const since = trips.filter((trip) => trip.startedAt > Date.parse(calibration.at));
  const days = Math.floor((Date.now() - Date.parse(calibration.at)) / 86_400_000);
  const peak = since.reduce<number | null>(
    (highest, trip) =>
      trip.maxRpm === null ? highest : highest === null || trip.maxRpm > highest ? trip.maxRpm : highest,
    null,
  );
  const beyond = peak !== null && peak > ranges.redline;

  return (
    <>
      <p className="backup__warning">
        {format(t.calibration.lastRun, {
          date: new Intl.DateTimeFormat(language, { dateStyle: 'short' }).format(
            new Date(calibration.at),
          ),
        })}
      </p>

      <dl className="calib-recap">
        <div>
          <dt>{t.calibration.idle}</dt>
          <dd>
            {calibration.idleRpm === null ? t.calibration.notMeasured : `${calibration.idleRpm} rpm`}
          </dd>
        </div>
        <div>
          <dt>{t.calibration.turbo}</dt>
          <dd>
            {calibration.turbo === null
              ? t.calibration.notMeasured
              : calibration.turbo
                ? t.calibration.yes
                : t.calibration.no}
          </dd>
        </div>
        <div>
          <dt>{t.calibration.redline}</dt>
          <dd>{calibration.redlineMeasured ? t.calibration.measured : t.calibration.inferred}</dd>
        </div>
        <div>
          <dt>{t.calibration.modesLearned}</dt>
          <dd>
            {calibration.signatures.length === 0
              ? t.calibration.modesNone
              : calibration.signatures
                  .map((signature: ModeSignature<DriveMode>) => t.driveModes[signature.mode])
                  .join(', ')}
          </dd>
        </div>
      </dl>

      {calibration.spread !== null && calibration.spread < USABLE_SPREAD && (
        <p className="settings__hint">
          <Sentences text={t.calibration.modesTooClose} />
        </p>
      )}

      {since.length > 0 && (
        <p className="settings__hint">
          <Sentences text={format(t.calibration.aged, { days, count: since.length })} />
        </p>
      )}

      {beyond && (
        <>
          <p className="settings__hint">
            <Sentences
              text={format(t.calibration.revsBeyond, { rpm: Math.round(peak as number) })}
            />
          </p>

          {/*
            Offered, never applied on its own.

            The reading is a floor - the engine goes at least that high - so the value adopted
            clears it rather than sitting on it, by the same rule the calibration uses for its own
            peak. Raising a redline moves the red zone on every dial, which is not a thing to do
            behind someone's back.
          */}
          <button
            type="button"
            className="chip"
            onClick={() => onAdoptRedline(redlineFromPeak(peak as number))}
          >
            {format(t.calibration.adoptRedline, { rpm: redlineFromPeak(peak as number) })}
          </button>
        </>
      )}
    </>
  );
}

/**
 * One trip: what it was, what deletes it, and what it looked like.
 *
 * The drawer is the catalogue's, through the same hook rather than a second implementation - a
 * gesture that opened at a different distance here would read as a different mechanism.
 *
 * The curves are fetched only when asked for. A list of thirty trips would otherwise read thirty
 * traces to draw one.
 */
function TripRow({
  trip,
  language,
  opened,
  onOpenedChange,
  expanded,
  onToggle,
  onDelete,
}: {
  readonly trip: TripRecord;
  readonly language: LanguageCode;
  readonly opened: boolean;
  readonly onOpenedChange: (opened: boolean) => void;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const t = useTranslation();
  const [trace, setTrace] = useState<TripTrace | null>(null);
  const { offset, dragging, handlers } = useSwipeToDelete({
    opened,
    onOpenedChange,
    enabled: true,
    onTap: onToggle,
  });

  /*
   * Fetched once the row is either unfolded or open.
   *
   * The drawer needs it too, not only the curves: the button says what deleting this trip frees,
   * and a figure that appeared a moment after the button did would be read as something changing.
   */
  useEffect(() => {
    if (!expanded && !opened) return;
    let alive = true;
    void readTrace(trip.id).then((found) => {
      if (alive) setTrace(found);
    });
    return () => {
      alive = false;
    };
  }, [expanded, opened, trip.id]);

  return (
    <li className="trips__entry">
      <div
        className={offset < 0 ? 'trips__row is-open' : 'trips__row'}
        style={{ '--reveal': `${REVEAL}px` } as React.CSSProperties}
      >
        {/*
          Out of the keyboard path while hidden, or tabbing would cross invisible delete buttons.
        */}
        <button
          type="button"
          className="trips__remove"
          onClick={onDelete}
          tabIndex={opened ? 0 : -1}
          aria-hidden={!opened}
          aria-label={t.settings.remove}
        >
          {/*
            What this frees, above the bin. Nothing at all for a trip with no trace: "0 ko" would
            promise a saving that deleting it cannot make.
          */}
          {trace !== null && (
            <span className="trips__weight">{byteSize(weightOf(trace), language)}</span>
          )}
          <TrashIcon />
        </button>

        <div
          className={offset < 0 ? 'trips__sliding is-open' : 'trips__sliding'}
          style={{
            transform: `translateX(${offset}px)`,
            transition: dragging ? 'none' : undefined,
          }}
          {...handlers}
        >
          <div className="trips__item">
            <span className="trips__head">
              <span className="trips__date">{tripDate(trip.startedAt, language)}</span>
              {/*
                A simulator demonstration would otherwise file among the real trips and skew every
                later reading of the history.
              */}
              {trip.source === 'simulated' && (
                <span className="trips__badge">{t.settings.simulator}</span>
              )}
            </span>

            <span className="trips__figures">
              {tripFigures(trip).map((figure) => (
                <span key={figure}>{figure}</span>
              ))}
            </span>
          </div>
        </div>
      </div>

      {/*
        Nothing at all when there is no trace: trips recorded before this existed have none, and an
        empty frame would suggest a drive with nothing in it.
      */}
      {expanded && trace !== null && <TripChart trace={trace} />}
    </li>
  );
}
