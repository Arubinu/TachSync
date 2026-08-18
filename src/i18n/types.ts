/**
 * Shape of a translation catalogue.
 *
 * Every language must provide every key: the type makes a missing string a
 * compile error rather than a blank label discovered on the road. There is no
 * fallback chain at runtime for the same reason — a silent fallback would let
 * an untranslated screen ship unnoticed.
 *
 * Keys are grouped by screen, not by word, so that a translator reads them in
 * the order they appear on screen and can judge tone and length in context.
 */

export interface Translation {
  readonly languageName: string;
  /**
   * The law comes before the dashboard.
   *
   * Top level rather than inside one screen: it holds for the whole application, and is shown
   * wherever the application asks a driver to do something.
   */
  readonly roadRules: string;

  readonly terms: {
    readonly title: string;
    readonly lead: string;
    readonly driver: string;
    readonly law: string;
    readonly attention: string;
    readonly noWarranty: string;
    readonly accept: string;
  };
  readonly connect: {
    readonly nearbyAdapters: string;
    readonly obdAdapter: string;
    readonly bluetoothUnavailable: string;
    readonly chooserHint: string;
    readonly chooseAdapter: string;
    readonly searching: string;
    readonly noAdapter: string;
    readonly searchInProgress: string;
    readonly selectionInterrupted: string;
    readonly scanFailed: string;
    readonly continueWithout: string;
    readonly simulatedData: string;
    readonly changeLanguage: string;
  };

  /**
   * OBD-II capture assistant.
   *
   * The `steps` carry the same ids as `CAPTURE_STEPS`: the log writes the id, the screen shows the
   * instruction, and neither depends on the other's language.
   */
  readonly capture: {
    readonly title: string;
    readonly safety: string;
    /** `{index}` and `{total}`. */
    readonly progress: string;
    readonly next: string;
    readonly finish: string;
    readonly done: string;
    readonly export: string;
    readonly steps: {
      readonly ignition: string;
      readonly idle: string;
      readonly gentleAccel: string;
      readonly firmAccel: string;
      readonly liftOff: string;
      readonly hardBrake: string;
      readonly cornerLeft: string;
      readonly cornerRight: string;
      readonly cruise: string;
      readonly shutdown: string;
    };
  };

  readonly discovery: {
    readonly insecureContext: string;
    readonly webView: string;
    readonly unsupportedBrowser: string;
    /**
     * Our own application, whose native Bluetooth bridge is not wired up yet. Distinct from
     * `webView`: telling someone who already has the application open to install it helps nobody.
     */
    readonly nativePending: string;
  };

  readonly settings: {
    readonly title: string;
    /** Current state of the light toggle, written on the button carrying it. */
    readonly lightOn: string;
    readonly lightOff: string;
    /** People, vehicles and appearances: who drives, in what, with which look. */
    readonly profiles: string;
    readonly person: string;
    readonly vehicleProfile: string;
    readonly look: string;
    /** Label for the name field: an action, since it sits beside the others. */
    readonly profileName: string;
    /** The new-vehicle notification: what happened, what to do, and that it can wait. */
    readonly vehicleDetected: string;
    readonly nameHint: string;
    /** The two full-scale values a vehicle carries. */
    readonly topSpeed: string;
    readonly redline: string;
    readonly duplicate: string;
    readonly newProfile: string;
    readonly appearance: string;
    readonly background: string;
    readonly avatar: string;
    readonly textScale: string;
    readonly language: string;
    readonly simulator: string;
    readonly calibration: string;
    readonly drivingStyle: string;
    readonly vehicle: string;
    readonly board: string;
    /** Names of the two orientations, for the two adjustable grids. */
    readonly landscape: string;
    readonly portrait: string;
    readonly editMode: string;
    readonly resetTrip: string;
    readonly imports: string;
    readonly delete: string;
    readonly tilesCount: string;
    readonly backgroundsCount: string;
    readonly trips: string;
    readonly noTrips: string;
    readonly clearTrips: string;
    readonly useTripHistory: string;
    readonly useTripHistoryOn: string;
    readonly useTripHistoryOff: string;
    readonly baselineFrom: string;
    readonly baselineTooFew: string;
    readonly backup: string;
    readonly export: string;
    readonly import: string;
    readonly remove: string;
    readonly backupHint: string;
    /** Warning shown above the backup buttons. */
    readonly backupWarning: string;
    /**
     * Notice written into the archive itself.
     *
     * A backup resurfaces months later, on another device, with no application
     * at hand to explain it — so it documents itself, in the language of the
     * person who made it. Placeholders: `{settings}`, `{avatars}`, `{readme}`
     * (entry names), `{list}` (the avatar inventory), `{ext}`.
     */
    readonly backupNotice: string;
    /** Stands in for `{list}` when nothing was imported. */
    readonly backupNoticeNoAvatars: string;
    readonly backupSaved: string;
    readonly backupSavedWithAvatars: string;
    readonly settingsRestored: string;
    readonly settingsAndAvatarsRestored: string;
    readonly avatarImported: string;
    readonly importFailed: string;
    readonly importBackground: string;
    readonly removeBackground: string;
    readonly importedImage: string;
    readonly backupNoticeWallpaper: string;
    readonly defaultBackground: string;
    readonly noTheme: string;
    readonly previousAvatar: string;
    readonly nextAvatar: string;
    readonly close: string;
  };

  readonly catalog: {
    readonly title: string;
    readonly hint: string;
    readonly import: string;
    readonly theme: string;
    readonly information: string;
    readonly all: string;
    readonly noMatch: string;
    readonly unavailableOnVehicle: string;
    readonly nothingImported: string;
    /** `{items}` lists what was added, e.g. “2 tile(s) and 1 background(s)”. */
    readonly importedPlain: string;
    /** Same, plus `{pack}`, the name the file declared. */
    readonly importedFrom: string;
    readonly andJoiner: string;
    /** Refusal shown to whoever tries to remove a built-in tile. */
    readonly cannotRemove: string;
  };

  readonly editor: {
    readonly layout: string;
    /** Refusal shown for a resize that would encroach on a neighbour. */
    readonly noRoom: string;
    /**
     * Refusal shown for a drop that cannot succeed.
     *
     * Distinct from `noRoom`, and not out of taste for vocabulary: there we refuse to disturb the
     * neighbours, here we would gladly disturb them but they have nowhere left to go. One word for
     * both would send the user looking for an obstructing neighbour that does not exist.
     */
    readonly boardFull: string;
    readonly holdForSettings: string;
    readonly scale: string;
    readonly layer: string;
    readonly orientation: string;
    readonly normal: string;
    readonly mirrored: string;
    readonly whenMissing: string;
    readonly missingOnVehicle: string;
    readonly missingGeneric: string;
    readonly hide: string;
    readonly keep: string;
    readonly delete: string;
    readonly close: string;
    readonly reset: string;
    readonly columns: string;
    readonly rows: string;
    readonly decrease: string;
    readonly increase: string;
    readonly tile: string;
    readonly spacing: string;
    /** Value shown when the tile defers to the theme's margin. */
    readonly spacingAuto: string;
    /** Full-width row: declared contact with the board edges. */
    /** How much of the theme's dressing the tile keeps: border, fill, or nothing. */
    readonly dressing: string;
    readonly caption: string;
    readonly captions: {
      readonly show: string;
      readonly hide: string;
      readonly spread: string;
    };
    readonly dressings: {
      readonly default: string;
      readonly borderless: string;
      readonly unfilled: string;
      readonly bare: string;
      readonly feathered: string;
    };
    readonly edges: string;
    readonly edgeSides: {
      readonly top: string;
      readonly right: string;
      readonly bottom: string;
      readonly left: string;
    };
    readonly edgeModes: {
      readonly auto: string;
      readonly force: string;
      readonly off: string;
    };
  };

  /**
   * The keyboard legend, shown only while a tile holds keyboard focus.
   *
   * The gestures teach themselves by trial; these do not, and nothing on a bare board hints
   * that Shift widens a tile.
   */
  readonly keyboard: {
    readonly title: string;
    readonly between: string;
    readonly grab: string;
    readonly nudge: string;
    readonly resize: string;
    readonly edit: string;
  };

  readonly editBar: {
    readonly addTile: string;
    readonly exitEditMode: string;
    readonly back: string;
    readonly columns: string;
    readonly columnsShort: string;
    readonly rows: string;
    readonly rowsShort: string;
    readonly add: string;
    readonly subtract: string;
    readonly activeLayer: string;
  };

  readonly status: {
    readonly disconnected: string;
    readonly connecting: string;
    readonly connected: string;
    readonly error: string;
  };

  readonly layers: {
    readonly background: string;
    readonly main: string;
    readonly front: string;
  };

  readonly profiles: {
    readonly eco: string;
    readonly normal: string;
    readonly sporty: string;
    readonly aggressive: string;
  };

  readonly metrics: {
    readonly speed: string;
    readonly rpm: string;
    readonly gear: string;
    readonly throttle: string;
    readonly boost: string;
    readonly consumption: string;
    readonly consumptionRate: string;
    readonly engineLoad: string;
    readonly coolant: string;
    readonly maf: string;
    readonly lateralG: string;
    readonly longitudinalG: string;
    readonly tripDistance: string;
    readonly tripAverage: string;
    readonly tripDuration: string;
    readonly avatar: string;
  };

  readonly categories: {
    readonly driving: string;
    readonly engine: string;
    readonly consumption: string;
    readonly trip: string;
    readonly character: string;
  };

  readonly avatars: {
    readonly neonFaceLabel: string;
    readonly neonFaceDescription: string;
    readonly plushLabel: string;
    readonly plushDescription: string;
  };

  readonly driveModes: {
    readonly eco: string;
    readonly normal: string;
    readonly sport: string;
  };
  readonly calibration: {
    readonly title: string;
    readonly done: string;
    readonly declareModes: string;
    readonly noModesHint: string;
    readonly start: string;
    readonly next: string;
    readonly skip: string;
    readonly stepOf: string;
    readonly driveInMode: string;
    readonly phases: {
      readonly warmup: string;
      readonly idle: string;
      readonly drive: string;
      readonly done: string;
    };
    /** No `done`: that phase shows the summary instead of an instruction. */
    readonly hints: {
      readonly warmup: string;
      readonly idle: string;
      readonly drive: string;
    };
    readonly idle: string;
    readonly redline: string;
    readonly topSpeed: string;
    readonly turbo: string;
    readonly modesLearned: string;
    readonly measured: string;
    readonly inferred: string;
    readonly notMeasured: string;
    readonly modesTooClose: string;
    readonly yes: string;
    readonly no: string;
    readonly apply: string;
    readonly export: string;
    readonly openFromSettings: string;
    readonly never: string;
    readonly lastRun: string;
    readonly recalibrate: string;
    readonly aged: string;
    readonly revsBeyond: string;
    readonly adoptRedline: string;
    readonly forget: string;
    readonly modesNone: string;
  };
  readonly transfer: {
    readonly title: string;
    readonly kinds: {
      readonly people: string;
      readonly vehicles: string;
      readonly appearances: string;
    };
    /** "Drop a {kind} file here, or tap to choose one." */
    readonly drop: string;
    /** "Only a {kind} can be imported here." */
    readonly scope: string;
    readonly export: string;
    /** "{name} added." */
    readonly added: string;
  };
  readonly errors: {
    readonly unreadableArchive: string;
    readonly notABackup: string;
    readonly incompleteArchive: string;
    readonly invalidJson: string;
    readonly unexpectedObject: string;
    readonly foreignBackup: string;
    readonly unknownAvatarFormat: string;
    readonly avatarTooLarge: string;
    readonly notAnImage: string;
    readonly imageTooLarge: string;
    readonly noTilesFound: string;
    readonly storageUnavailable: string;
    readonly notAnEntity: string;
    readonly wrongEntityKind: string;
    readonly unreadableAvatarFile: string;
    readonly notRiveDocument: string;
    readonly riveDecodeFailed: string;
    readonly riveNoStateMachine: string;
    readonly notGltfModel: string;
    readonly gltfDecodeFailed: string;
  };
}

/** Language tags handled by the application. */
export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'nl' | 'it' | 'pt';

export const LANGUAGES: readonly LanguageCode[] = ['en', 'fr', 'es', 'de', 'nl', 'it', 'pt'];
