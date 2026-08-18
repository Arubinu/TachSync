import { useCallback, useEffect, useMemo, useState } from 'react';
import { Board } from './board/Board';
import { ConnectScreen } from './board/ConnectScreen';
import { CaptureGuide } from './board/CaptureGuide';
import { CalibrationScreen } from './board/CalibrationScreen';
import { TermsScreen } from './board/TermsScreen';
import type { CalibrationResult } from './obd/calibrationRun';
import type { DriveMode } from './analysis/driveMode';
import { TransportRecorder } from './obd/recorder';
import { captureFileName } from './obd/capture';
import { WebBluetoothTransport } from './obd/WebBluetoothTransport';
import { ObdBleSource } from './obd/ObdBleSource';
import { SettingsPanel } from './board/SettingsPanel';
import { TileEditor } from './board/TileEditor';
import { holdUpdates } from './pwa/updates';
import {
  metricLabel,
  GRID_COLUMNS,
  GRID_ROWS,
  reflowIntoGrid,
  type AppSettings,
  type LayerIndex,
  type LayoutConfig,
  type Orientation,
  type TileConfig,
} from './board/layout';
import { useOrientation } from './board/useOrientation';
import { useWakeLock } from './hooks/useWakeLock';
import { useEscapeBlur } from './hooks/useEscapeBlur';
import { useAvatars } from './avatar/useAvatars';
import { cycleAvatar } from './avatar/registry';
import { CATALOGUES, TranslationContext, format, nextLanguage } from './i18n';
import { findPreset, presetLabel } from './board/presets';
import { Backdrop } from './board/Backdrop';
import { useWallpaper } from './board/useWallpaper';
import { WALLPAPER_ID } from './board/wallpaper';
import { resolveBackground } from './board/backgrounds';
import { ScopedTileStyles } from './board/ScopedTileStyles';
import { parseTilePack } from './board/tileImport';
import { backupFileName, createBackup, downloadBackup, readBackup } from './board/backup';
import { SimulatedSource } from './simulation/SimulatedSource';
import type { DrivingProfile } from './simulation/driver';
import { VEHICLE_PRESETS, type VehicleSpec } from './simulation/vehicle';
import type { ConnectionStatus, DataSource } from './telemetry/DataSource';
import { TelemetryStore } from './telemetry/TelemetryStore';
import type { AnyChannel } from './telemetry/types';
import { themeToCssVariables } from './theme/themes';
import { lightenTheme } from './theme/light';
import { clearTrips, listTrips, saveTrip } from './trips/store';
import { readBaseline } from './analysis/baseline';
import type { TripRecord } from './trips/types';
import { useTripRecording } from './trips/useTripRecording';
import { useDriveMode } from './analysis/useDriveMode';
import {
  activePerson,
  activeVehicle,
  applySettings,
  resolveSettings,
  type ProfileState,
} from './profiles/state';
import { entityLabel } from './profiles/actions';
import { recognizeVehicle } from './profiles/recognize';
import { loadProfileState, replaceFromSettings, saveProfileState } from './profiles/storage';

/**
 * How long the new-vehicle notification stays up.
 *
 * Shared with the bar that counts it down: it is passed to the stylesheet as a custom property,
 * otherwise the two would drift and the bar would empty well before - or after - the notification
 * goes.
 */
const INTRODUCTION_LIFE_MS = 8000;

function clampInt(value: number, bounds: { readonly min: number; readonly max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

export function App(): React.JSX.Element {
  /**
   * Profiles are the truth; flat settings are the view.
   *
   * The rest of the application still reads and writes an `AppSettings` as before: `setSettings`
   * routes each field to its owner - appearance, vehicle, or shared. Twenty write sites never had
   * to learn the model, and none can forget it.
   */
  const [profiles, setProfiles] = useState<ProfileState>(loadProfileState);
  const settings = useMemo(() => resolveSettings(profiles), [profiles]);

  const setSettings = useCallback(
    (next: AppSettings | ((current: AppSettings) => AppSettings)) => {
      setProfiles((state) => {
        const current = resolveSettings(state);
        return applySettings(state, typeof next === 'function' ? next(current) : next);
      });
    },
    [],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editingTileId, setEditingTileId] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [settingsReport, setSettingsReport] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerIndex>(1);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [availableChannels, setAvailableChannels] = useState<ReadonlySet<AnyChannel>>(
    () => new Set(),
  );

  const [profile, setProfile] = useState<DrivingProfile>('normal');
  const [vehicle, setVehicle] = useState<VehicleSpec>(() => VEHICLE_PRESETS[0]!);

  /**
   * Data source, chosen on the connect screen.
   *
   * `null` until something is chosen: the board is meaningless without a source, and empty tiles on
   * open would look like a broken application.
   */
  const [sourceKind, setSourceKind] = useState<'simulated' | 'obd' | null>(null);

  /**
   * Current orientation and its layout. Switching is automatic: a grid composed for a landscape
   * screen makes no sense upright, and rearranging on every rotation would undo the previous work.
   */
  const orientation = useOrientation();
  const layout = settings.layouts[orientation];

  // Requested for the whole application, connect screen included: waiting for an adapter is exactly
  // when the screen would switch off.
  useWakeLock();

  // Escape gives focus back once no window claims it.
  useEscapeBlur();

  // A pending version waits for the drive to end: applying it reloads the page, which drops the
  // adapter link that only a user gesture can re-establish.
  useEffect(() => holdUpdates(sourceKind !== null), [sourceKind]);

  const translation = CATALOGUES[settings.language];

  /** Built-in and imported avatars. Loaded once, at startup. */
  const avatarLibrary = useAvatars(translation);

  /** The imported background image, if there is one. Loaded once, at startup. */
  const wallpaperLibrary = useWallpaper(translation);

  // Store and simulator live as long as the application.
  const store = useMemo(() => new TelemetryStore(), []);
  const simulator = useMemo(() => new SimulatedSource({ frequencyHz: 10 }), []);

  /**
   * Active source. The simulator by default, a real adapter once connected - the board cannot tell
   * the difference, which is the point of the `DataSource` interface.
   */
  const [source, setSource] = useState<DataSource>(simulator);

  /**
   * Recorder for the current session, if any. Its presence is what distinguishes a recorded session
   * from an ordinary connection.
   */
  const [recorder, setRecorder] = useState<TransportRecorder | null>(null);

  /**
   * A car has just been recognised: offer to name it.
   *
   * Three states rather than two: the notification must stay mounted while it leaves, otherwise it
   * vanishes at once and the animation is never seen.
   */
  const [introduced, setIntroduced] = useState<'in' | 'out' | null>(null);

  /** Trip history, read at startup and after each recording. */
  const [trips, setTrips] = useState<readonly TripRecord[]>([]);
  const refreshTrips = useCallback(() => void listTrips().then(setTrips), []);
  useEffect(refreshTrips, [refreshTrips]);

  /**
   * Long-window driving mode. It decides the ambience only; the character follows the instantaneous
   * style. Two time scales are what make the screen alive without making it epileptic.
   */
  const driveMode = useDriveMode(
    store,
    activeVehicle(profiles).ranges.redline,
    sourceKind !== null,
    activeVehicle(profiles).calibration,
  );

  /*
   * The driver's own ordinary, when they asked for it.
   *
   * Read from the trips of the active vehicle: a van and a hatchback are not driven alike, and one
   * baseline across both would describe neither. Zero while the setting is off, which restores the
   * fixed thresholds exactly - nothing is rewritten, the trips are only read.
   */
  const baselineShift = useMemo(() => {
    if (!settings.useTripHistory) return 0;
    const label = entityLabel(
      activeVehicle(profiles),
      profiles.vehicles.indexOf(activeVehicle(profiles)),
      translation.settings.vehicleProfile,
    );
    return readBaseline(trips, label)?.shift ?? 0;
  }, [settings.useTripHistory, trips, profiles, translation]);

  const { restart: restartTrip } = useTripRecording({
    store,
    source: sourceKind,
    // The profile's vehicle, not the simulator's physical spec: a trip belongs to the user's car,
    // not to the model used to fabricate frames.
    vehicle: entityLabel(
      activeVehicle(profiles),
      profiles.vehicles.indexOf(activeVehicle(profiles)),
      translation.settings.vehicleProfile,
    ),
    redline: activeVehicle(profiles).ranges.redline,
    onSaved: refreshTrips,
  });

  useEffect(() => {
    if (sourceKind === null) return;

    const unsubscribeFrame = source.onFrame((frame) => store.push(frame));
    const unsubscribeStatus = source.onStatusChange((next) => {
      setStatus(next);
      setAvailableChannels(new Set(source.getAvailableChannels()));
    });

    void source.connect();

    return () => {
      unsubscribeFrame();
      unsubscribeStatus();
      void source.disconnect();
    };
  }, [source, store, sourceKind]);

  /**
   * An unnamed vehicle is, broadly, a new vehicle.
   *
   * The very first launch has no adapter to recognise, so nothing fired - yet the situation is the
   * same: a car with no name, and someone who can give it one. The same notification serves both
   * cases rather than a separate welcome saying the same thing differently.
   *
   * Once per launch, and never if the car has a name: that is what distinguishes an offer from a
   * nag.
   */
  useEffect(() => {
    if (sourceKind === null) return;
    setIntroduced((current) =>
      current === null && activeVehicle(profiles).label.trim() === '' ? 'in' : current,
    );
    // `profiles` deliberately absent: this looks at arrival on the board, not at every rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKind]);

  useEffect(() => {
    if (introduced !== 'in') return;
    // Long enough to be read at a red light, short enough not to clutter the road. Missing it costs
    // nothing: renaming still lives in the settings.
    const timer = window.setTimeout(() => setIntroduced('out'), INTRODUCTION_LIFE_MS);
    return () => window.clearTimeout(timer);
  }, [introduced]);

  useEffect(() => {
    saveProfileState(profiles, settings);
  }, [profiles, settings]);

  // The reference theme comes from the selected BACKGROUND, not the catalogue filter; otherwise
  // filtering tiles would repaint the whole screen.
  const {
    theme: painted,
    imported: importedBackground,
    wallpaper: showWallpaper,
  } = resolveBackground(settings, wallpaperLibrary.wallpaper !== null);
  // The light theme is derived from the dark one rather than existing alongside it - see
  // `theme/light`. A theme that declares itself light comes back untouched.
  const theme = settings.light ? lightenTheme(painted) : painted;

  useEffect(() => {
    const variables = themeToCssVariables(theme);
    for (const [name, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(name, value);
    }
  }, [theme]);

  /**
   * Interface appearance, set on the root.
   *
   * An attribute rather than variables written one by one: the window palette is an application
   * constant, not data, and the stylesheet is the right place for it.
   *
   * The adapter chooser escapes it and stays dark. It has its own nocturnal decor belonging to no
   * theme: it is the application's antechamber, not the dashboard yet.
   */
  useEffect(() => {
    const light = settings.light && sourceKind !== null;
    document.documentElement.dataset['appearance'] = light ? 'light' : 'dark';
  }, [settings.light, sourceKind]);

  // The document language follows the interface, which the markup cannot know: a screen reader
  // otherwise reads English or German text with the phonetics `index.html` declared once and for
  // all. Measured: the document said French while the whole interface was in English.
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  // The mode is set as an attribute, like the appearance: the stylesheet knows better than the code
  // what a decor should do with it, and the slow drift is one line there.
  useEffect(() => {
    document.documentElement.dataset['drive'] = driveMode;
  }, [driveMode]);

  /**
   * Applies a transformation to the current orientation's layout.
   *
   * Every grid change goes through here: without this single point, each site would have to
   * remember which of the two to target, and a slip would silently write into the one nobody is
   * looking at.
   */
  function editLayout(transform: (layout: LayoutConfig) => LayoutConfig): void {
    setSettings((current) => ({
      ...current,
      layouts: { ...current.layouts, [orientation]: transform(current.layouts[orientation]) },
    }));
  }

  function updateTile(next: TileConfig): void {
    editLayout((layout) => ({
      ...layout,
      tiles: layout.tiles.map((tile) => (tile.id === next.id ? next : tile)),
    }));
  }

  function deleteTile(id: string): void {
    editLayout((layout) => ({ ...layout, tiles: layout.tiles.filter((tile) => tile.id !== id) }));
    setEditingTileId(null);
  }

  function handleCommitLayout(tiles: readonly TileConfig[]): void {
    editLayout((layout) => ({ ...layout, tiles }));
  }

  async function importTiles(file: File): Promise<void> {
    const result = parseTilePack(await file.text(), file.name, translation);

    if (result.presets.length > 0 || result.backgrounds.length > 0) {
      setSettings((current) => ({
        ...current,
        presets: [...current.presets, ...result.presets],
        backgrounds: [...current.backgrounds, ...result.backgrounds],
      }));
    }

    // A partial import is a normal case: add what is valid and say precisely what was rejected,
    // rather than refusing everything.
    const parts: string[] = [];
    if (result.presets.length > 0) {
      parts.push(`${result.presets.length} ${translation.settings.tilesCount}`);
    }
    if (result.backgrounds.length > 0) {
      parts.push(`${result.backgrounds.length} ${translation.settings.backgroundsCount}`);
    }

    const items = parts.join(` ${translation.catalog.andJoiner} `);
    const added =
      parts.length === 0
        ? translation.catalog.nothingImported
        : result.pack === null
          ? format(translation.catalog.importedPlain, { items })
          : format(translation.catalog.importedFrom, { items, pack: result.pack });

    setImportReport([added, ...result.errors].join(' '));
  }

  function deletePreset(id: string): void {
    setSettings((current) => ({
      ...current,
      presets: current.presets.filter((preset) => preset.id !== id),
    }));
  }

  async function exportBackup(): Promise<void> {
    const avatars = await avatarLibrary.records();
    downloadBackup(
      await createBackup(profiles, trips, avatars, wallpaperLibrary.wallpaper, translation),
      backupFileName(),
    );
    setSettingsReport(
      avatars.length === 0
        ? translation.settings.backupSaved
        : format(translation.settings.backupSavedWithAvatars, { count: avatars.length }),
    );
  }

  async function importBackup(file: File): Promise<void> {
    const result = await readBackup(file, translation);

    if (result.profiles === null && result.settings === null) {
      setSettingsReport(result.error);
      return;
    }

    /*
     * A restore replaces the whole configuration.
     *
     * A current file carries every person, vehicle and look, so it lands as it is. One written
     * before that carried only the resolved settings of the active profile, and rebuilds a single
     * set from them - all those files ever held.
     */
    setProfiles(
      result.profiles ?? replaceFromSettings(result.settings as AppSettings).state,
    );

    // The history travels too. Replaced rather than merged: a backup is a state to return to, and
    // two histories interleaved would belong to neither.
    await clearTrips();
    for (const trip of result.trips) await saveTrip(trip);
    setTrips(await listTrips());
    // Avatars are restored one by one: the import validates each and silently drops anything
    // unrecognised.
    for (const avatar of result.avatars) await avatarLibrary.importFile(avatar);

    // Restored without selecting it: the look that came with the backup already says whether it
    // was in use, and forcing the choice would override what the file itself carries.
    if (result.wallpaper !== null) await wallpaperLibrary.importFile(result.wallpaper);

    setSettingsReport(
      result.avatars.length === 0
        ? translation.settings.settingsRestored
        : format(translation.settings.settingsAndAvatarsRestored, {
            count: result.avatars.length,
          }),
    );
  }

  /** Removes in one go everything a file brought in. */
  function deletePack(pack: string): void {
    setSettings((current) => {
      const backgrounds = current.backgrounds.filter((background) => background.pack !== pack);
      const stillThere = backgrounds.some(
        (background) => background.id === current.backgroundId,
      );
      return {
        ...current,
        presets: current.presets.filter((preset) => preset.pack !== pack),
        backgrounds,
        // The selected background may have just disappeared: fall back to the theme's rather than
        // leave a dead reference.
        backgroundId: stillThere ? current.backgroundId : null,
      };
    });
  }

  // Picked rather than cycled: the toolbar shows all three layers.
  function selectLayer(layer: LayerIndex): void {
    setActiveLayer(layer);
  }

  /**
   * Resizes the grid of a named orientation.
   *
   * Named rather than "current": the settings allow adjusting portrait from landscape, which cannot
   * be done otherwise - turning the device to adjust the other grid would mean holding the screen
   * while doing it.
   */
  function changeGridFor(target: Orientation, columnsDelta: number, rowsDelta: number): void {
    setSettings((current) => ({
      ...current,
      layouts: { ...current.layouts, [target]: resize(current.layouts[target]) },
    }));

    function resize(layout: LayoutConfig): LayoutConfig {
      const columns = clampInt(layout.columns + columnsDelta, GRID_COLUMNS);
      const rows = clampInt(layout.rows + rowsDelta, GRID_ROWS);
      // Shrinking the grid would otherwise leave tiles off screen.
      return { columns, rows, tiles: reflowIntoGrid(layout.tiles, columns, rows) };
    }
  }

  function changeGrid(columnsDelta: number, rowsDelta: number): void {
    editLayout((layout) => {
      // The same bounds as in the settings: two different ceilings for the same gesture depending
      // on where it is made would make no sense.
      const columns = clampInt(layout.columns + columnsDelta, GRID_COLUMNS);
      const rows = clampInt(layout.rows + rowsDelta, GRID_ROWS);
      return {
        columns,
        rows,
        // Shrinking the grid would otherwise leave tiles off screen.
        tiles: reflowIntoGrid(layout.tiles, columns, rows),
      };
    });
  }

  /**
   * A tile created then abandoned without choosing a metric must not stay: it would clutter the
   * grid while showing nothing.
   */
  function closeTileEditor(): void {
    const tile = layout.tiles.find((candidate) => candidate.id === editingTileId);
    if (tile !== undefined && tile.metrics.length === 0) {
      deleteTile(tile.id);
      return;
    }
    setEditingTileId(null);
  }

  function changeVehicle(next: VehicleSpec): void {
    setVehicle(next);
    // On the simulator, never on the active source: a real vehicle has its own, and reassigning it
    // would make no sense.
    simulator.setVehicle(next);
    // Changing vehicle changes the available channels: without a turbo, tiles set to `hide`
    // disappear.
    setAvailableChannels(new Set(simulator.getAvailableChannels()));
  }

  /**
   * Switches to a real adapter.
   *
   * The browser chooser has already returned the device: `request` merely asks for it again, the
   * only route Web Bluetooth offers - a page may not keep a reference across screens.
   */
  async function connectAdapter(capture: boolean): Promise<void> {
    const transport = await WebBluetoothTransport.request();
    if (transport === null) return;

    // The recorder sits between the client and the link, so it sees the ELM327 handshake, which
    // goes out before everything else and is exactly the part worth replaying.
    //
    // The car is recognised by its adapter: a known id selects its vehicle, an unknown one creates
    // it.
    setProfiles((state) => {
      const { state: next, introduced } = recognizeVehicle(
        state,
        transport.device.id,
        transport.device.name,
      );
      // The invitation to name appears only at first meeting and blocks nothing: one is at the
      // wheel with the engine running, and typing a name can wait. Until then the car carries its
      // adapter's name.
      if (introduced) setIntroduced('in');
      return next;
    });

    const recorded = capture ? new TransportRecorder(transport) : null;
    setRecorder(recorded);

    setSource(new ObdBleSource(recorded ?? transport));
    setSourceKind('obd');
  }

  function exportCapture(): void {
    if (recorder === null) return;
    const blob = new Blob([recorder.toLog(vehicle.label)], { type: 'text/plain' });
    downloadBackup(blob, captureFileName());
  }

  /**
   * The calibration as a file.
   *
   * JSON rather than the capture log's prose: this one is meant to be read by the project, not by
   * a person - a vehicle profile that a pull request can carry as it stands.
   */
  function exportCalibration(result: CalibrationResult<DriveMode>): void {
    const vehicle = activeVehicle(profiles);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            vehicle: vehicle.label,
            at: new Date().toISOString(),
            idleRpm: result.idleRpm,
            limiterRpm: result.limiterRpm,
            peakRpm: result.peakRpm,
            peakSpeed: result.peakSpeed,
            turbo: result.turbo,
            spread: result.spread,
            signatures: result.signatures,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const day = new Date().toISOString().slice(0, 10);
    downloadBackup(blob, `tachsync-calibration-${day}.json`);
  }

  function changeProfile(next: DrivingProfile): void {
    setProfile(next);
    simulator.setProfile(next);
  }

  const editingTile = layout.tiles.find((tile) => tile.id === editingTileId) ?? null;

  /**
   * Name of a placed tile: its preset's if it came from one, otherwise the list of its metrics -
   * exactly what the catalogue shows, so the dropped tile is recognisable.
   */
  function tileTitle(tile: TileConfig): string {
    const preset = tile.presetId === null ? null : findPreset(tile.presetId, settings.presets);
    if (preset !== null) return presetLabel(preset, translation);

    const metrics = tile.metrics.map((metric) => metricLabel(metric, translation));
    return metrics.length > 0 ? metrics.join(' · ') : translation.editor.tile;
  }

  /**
   * Settings, rendered from both screens.
   *
   * The identity banner on the adapter screen links here: administering a profile is rare and
   * deliberate, and has no business on the launch path. Without this the button would open nothing,
   * the panel being mounted only with the board.
   */
  const settingsPanel = settingsOpen ? (
    <SettingsPanel
      settings={settings}
      onGridChange={changeGridFor}
      profile={profile}
      vehicle={vehicle}
      onChange={setSettings}
      onProfileChange={changeProfile}
      onVehicleChange={changeVehicle}
      profiles={profiles}
      onProfilesChange={setProfiles}
      trips={trips}
      onClearTrips={() => void clearTrips().then(refreshTrips)}
      onResetTrip={() => {
        store.resetTrip();
        // The recorder restarts with the counters: otherwise it would see its distance shrink and
        // keep a truncated trip.
        restartTrip();
      }}
      onDeletePack={deletePack}
      onExport={() => void exportBackup()}
      onImportSettings={(file: File) => void importBackup(file)}
      library={avatarLibrary}
      wallpaper={wallpaperLibrary.wallpaper}
      wallpaperReport={wallpaperLibrary.report}
      wallpaperReportId={wallpaperLibrary.reportId}
      /*
       * Imported, then selected.
       *
       * Bringing in an image and leaving the old background painted would read as a failure. Only
       * on success, so a refused file changes nothing on screen.
       */
      onImportWallpaper={(file: File) => {
        void wallpaperLibrary.importFile(file).then((taken) => {
          if (taken) setSettings((current) => ({ ...current, backgroundId: WALLPAPER_ID }));
        });
      }}
      onRemoveWallpaper={() => {
        void wallpaperLibrary.remove().then(() => {
          // Back to the theme's own background, but only for a look that was pointing at the image:
          // another one may have its own choice, which deleting a photo has no business changing.
          setSettings((current) =>
            current.backgroundId === WALLPAPER_ID ? { ...current, backgroundId: null } : current,
          );
        });
      }}
      onCycleAvatar={(direction) =>
        setSettings((current) => ({
          ...current,
          avatarId: cycleAvatar(current.avatarId, direction),
        }))
      }
      /*
       * Calibrating needs a real car.
       *
       * Run against the simulator it would measure the physics model and write its numbers into a
       * vehicle profile, where they would look like measurements of the car in the driveway.
       */
      onCalibrate={
        sourceKind === 'obd'
          ? () => {
              setSettingsOpen(false);
              setCalibrating(true);
            }
          : null
      }
      source={sourceKind}
      settingsReport={settingsReport}
      onClose={() => setSettingsOpen(false)}
    />
  ) : null;

  /*
   * The terms come before the adapter screen.
   *
   * Ahead rather than behind: accepting them once figures are already on screen would be a
   * formality. Answered once and remembered, so this is the only launch that shows it.
   */
  if (!settings.termsAccepted) {
    return (
      <TranslationContext value={translation}>
        <TermsScreen
          language={settings.language}
          onCycleLanguage={() =>
            setSettings((current) => ({ ...current, language: nextLanguage(current.language) }))
          }
          onAccept={() => setSettings((current) => ({ ...current, termsAccepted: true }))}
        />
      </TranslationContext>
    );
  }

  if (sourceKind === null) {
    return (
      <TranslationContext value={translation}>
        <ConnectScreen
          language={settings.language}
          onCycleLanguage={() =>
            setSettings((current) => ({ ...current, language: nextLanguage(current.language) }))
          }
          onConnect={(_device, options) => void connectAdapter(options?.capture === true)}
          identity={{
            person: entityLabel(
              activePerson(profiles),
              profiles.people.indexOf(activePerson(profiles)),
              translation.settings.person,
            ),
            vehicle: entityLabel(
              activeVehicle(profiles),
              profiles.vehicles.indexOf(activeVehicle(profiles)),
              translation.settings.vehicleProfile,
            ),
            // Profiles are administered in the settings, never on the launch path: choosing is
            // frequent, administering is rare, and a delete button two taps from startup is a
            // hazard in a car.
            onEdit: () => setSettingsOpen(true),
          }}
          onSimulate={() => setSourceKind('simulated')}
        />

        {settingsPanel}
      </TranslationContext>
    );
  }

  return (
    <TranslationContext value={translation}>
      <ScopedTileStyles presets={settings.presets} backgrounds={settings.backgrounds} />
      {/* Inline style, not a class: the URL is minted per session, and no stylesheet can hold that. */}
      {showWallpaper && wallpaperLibrary.url !== null && (
        <div
          className="wallpaper"
          style={{ backgroundImage: `url("${wallpaperLibrary.url}")` }}
          aria-hidden
        />
      )}

      <Backdrop background={importedBackground} store={store} />

      {/*
        Above the board: during a capture the instruction is the only thing to read, and nothing
        else must be touchable.
      */}
      {calibrating && (
        <CalibrationScreen
          store={store}
          vehicleLabel={entityLabel(
            activeVehicle(profiles),
            profiles.vehicles.indexOf(activeVehicle(profiles)),
            translation.settings.vehicleProfile,
          )}
          ranges={activeVehicle(profiles).ranges}
          onApply={(calibration, ranges) => {
            const target = activeVehicle(profiles).id;
            setProfiles((current) => ({
              ...current,
              vehicles: current.vehicles.map((vehicle) =>
                vehicle.id === target ? { ...vehicle, calibration, ranges } : vehicle,
              ),
            }));
            setCalibrating(false);
          }}
          onExport={exportCalibration}
          onClose={() => setCalibrating(false)}
        />
      )}

      {recorder !== null && (
        <CaptureGuide
          onMark={(stepId) => recorder.mark(stepId)}
          onExport={exportCapture}
          onClose={() => setRecorder(null)}
        />
      )}

      {/*
        The invitation to name, rather than another screen.

        A car met for the first time carries its adapter's name - "OBDII" identifies nobody, but
        the drive has already started. Offering here leaves the choice of renaming now or never; an
        intermediate page would have demanded typing with the engine running.

        The whole notification is the button and there is no close cross: a single target can be
        hit without looking, and dismissing something that leaves on its own after eight seconds
        only adds a second place to go wrong.
      */}
      {introduced !== null && (
        <button
          type="button"
          className={introduced === 'out' ? 'introduction is-leaving' : 'introduction'}
          role="status"
          style={{ '--introduction-life': `${INTRODUCTION_LIFE_MS}ms` } as React.CSSProperties}
          onClick={() => {
            setIntroduced(null);
            setSettingsOpen(true);
          }}
          // Unmount once the exit is done. The guard excludes the gauge animation, which plays
          // inside and bubbles up here.
          onAnimationEnd={(event) => {
            if (introduced === 'out' && event.target === event.currentTarget) setIntroduced(null);
          }}
        >
          {/*
            The gauge counts down the time left: the notification does not vanish unannounced.
          */}
          <span className="introduction__life" aria-hidden />

          <span className="introduction__title">{translation.settings.vehicleDetected}</span>
          <span className="introduction__hint">{translation.settings.nameHint}</span>
        </button>
      )}

      <Board
        baselineShift={baselineShift}
        store={store}
        ranges={activeVehicle(profiles).ranges}
        settings={settings}
        layout={layout}
        theme={theme}
        status={status}
        availableChannels={availableChannels}
        activeLayer={activeLayer}
        catalogOpen={catalogOpen}
        panelOpen={settingsOpen || editingTileId !== null}
        onOpenCatalog={() => setCatalogOpen(true)}
        onCloseCatalog={() => setCatalogOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onEditTile={setEditingTileId}
        onCommitLayout={handleCommitLayout}
        onImport={(file: File) => void importTiles(file)}
        onDeletePreset={deletePreset}
        importReport={importReport}
        onCatalogThemeChange={(themeId) => setSettings((current) => ({ ...current, themeId }))}
        onMetricFilterChange={(metricFilter) =>
          setSettings((current) => ({ ...current, metricFilter }))
        }
        onSelectLayer={selectLayer}
        editBarDock={settings.editBarDock}
        onEditBarDock={(editBarDock) => setSettings((current) => ({ ...current, editBarDock }))}
        onGridChange={changeGrid}
        onExitEdit={() => setSettings((current) => ({ ...current, locked: true }))}
      />

      {editingTile !== null && (
        <TileEditor
          tile={editingTile}
          title={tileTitle(editingTile)}
          preset={findPreset(editingTile.presetId ?? '', settings.presets)}
          tiles={layout.tiles}
          columns={layout.columns}
          rows={layout.rows}
          availableChannels={availableChannels}
          onChange={updateTile}
          onDelete={() => deleteTile(editingTile.id)}
          onClose={closeTileEditor}
        />
      )}

      {settingsPanel}
    </TranslationContext>
  );
}
