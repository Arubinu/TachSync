import type { Translation } from './types';

/**
 * English — the reference catalogue.
 *
 * Other languages are translated from this one, and it is the fallback when the
 * browser reports a language the application does not carry.
 */
export const en: Translation = {
  languageName: 'English',
  roadRules: 'On public roads the highway code comes first. This application never justifies an infringement, and no step of the calibration requires one.',

  terms: {
    title: 'Before driving',
    lead: 'This application displays. It does not drive.',
    driver: 'You alone are responsible for your driving, your vehicle and everyone around you. Nothing shown here relieves you of that, at any moment.',
    law: 'The highway code comes first, always. No reading and no step of the calibration justifies exceeding a limit or taking a risk.',
    attention: 'The screen is read at a glance, never operated while driving. During a capture or a calibration, let your passenger do it.',
    noWarranty: 'The readings come from your vehicle and may be wrong, late or missing. Never rely on them where safety depends on it. Supplied as is, with no warranty.',
    accept: 'I understand and accept',
  },
  connect: {
    nearbyAdapters: 'Nearby adapters',
    obdAdapter: 'OBD-II adapter',
    bluetoothUnavailable: 'Bluetooth unavailable',
    chooserHint:
      'The browser shows the device list itself: it does not let a page inventory your Bluetooth.',
    chooseAdapter: 'Choose an adapter',
    searching: 'Searching…',
    noAdapter: 'No adapter found.',
    searchInProgress: 'Search in progress',
    selectionInterrupted: 'Selection interrupted.',
    scanFailed: 'Search failed.',
    continueWithout: 'Continue without an adapter',
    simulatedData: 'Simulated data',
    changeLanguage: 'Change language',
  },

  capture: {
    title: 'OBD capture',
    safety: 'Let your passenger do it. Never operate the screen while driving.',
    progress: 'Step {index} of {total}',
    next: 'Next step',
    finish: 'Finish',
    done: 'Capture complete.',
    export: 'Export the log',
    steps: {
      ignition: 'Ignition on, engine off. Wait for the adapter to settle.',
      idle: 'Start the engine and let it idle.',
      gentleAccel: 'Accelerate gently to about 50 km/h, then hold steady.',
      firmAccel: 'Accelerate firmly through two gear changes.',
      liftOff: 'Lift off and let the engine brake.',
      hardBrake: 'Brake firmly, where it is safe to do so.',
      cornerLeft: 'Take a tight left-hand corner.',
      cornerRight: 'Take a tight right-hand corner.',
      cruise: 'Hold a steady 80–90 km/h for a minute.',
      shutdown: 'Pull over, idle for a moment, then switch off.',
    },
  },

  discovery: {
    insecureContext:
      'Bluetooth requires a secure connection. Open the site over HTTPS, or install the app.',
    webView:
      'This embedded view has no Bluetooth access. Open the site in Chrome, or install the app.',
    unsupportedBrowser: 'This browser does not support Bluetooth. Chrome on Android does.',
    nativePending:
      'Bluetooth is not wired into this version of the app yet. Use the simulator meanwhile.',
  },

  settings: {
    title: 'Settings',
    lightOn: 'Light theme',
    lightOff: 'Dark theme',
    profiles: 'Profiles',
    person: 'Person',
    vehicleProfile: 'Vehicle',
    look: 'Look',
    profileName: 'Rename',
    vehicleDetected: 'New vehicle detected',
    nameHint: 'Tap to name it, or do it later in the profile settings.',
    topSpeed: 'Top speed',
    redline: 'Redline',
    duplicate: 'Duplicate',
    newProfile: 'New',
    appearance: 'Appearance',
    background: 'Background',
    avatar: 'Avatar',
    textScale: 'Text scale',
    language: 'Language',
    simulator: 'Simulator',
    calibration: 'Calibration',
    drivingStyle: 'Driving style',
    vehicle: 'Vehicle',
    board: 'Board',
    landscape: 'Landscape',
    portrait: 'Portrait',
    editMode: 'Edit mode',
    resetTrip: 'Reset trip',
    imports: 'Imports',
    delete: 'Delete',
    tilesCount: 'tile(s)',
    backgroundsCount: 'background(s)',
    trips: 'Trips',
    noTrips: 'No trip recorded yet.',
    clearTrips: 'Clear all',
    useTripHistory: 'Use my trips as a reference',
    useTripHistoryOn: 'On',
    useTripHistoryOff: 'Off',
    baselineFrom: 'Read from {count} trips. Your ordinary driving sets where "spirited" begins.',
    baselineTooFew: 'Needs {count} trips on this vehicle before it can say anything.',
    backup: 'Backup',
    export: 'Export',
    import: 'Import',
    remove: 'Remove',
    backupHint:
      'Settings and avatars in a single .{ext} file. Everything lives in this browser; importing replaces it all.',
    backupWarning: 'Everything is reset on import!',
    backupNotice: `TACHSYNC BACKUP
===============

This file is an ordinary ZIP archive under an application-specific
extension. To open it with your system tool, rename it to .zip —
nothing else is needed.

CONTENTS
--------

  {settings}
      Your settings, as indented JSON: tile layout per orientation,
      imported tiles and backgrounds, chosen avatar, text scale.
      Readable and editable in any text editor.

  {avatars}
      The avatar files you had imported, as-is (.riv, .glb or .gltf).
      They do not fit in the settings file: they are binaries of
      several megabytes.

{list}{wallpaper}

  {readme}
      This notice.

RESTORING
---------

Settings -> Backup -> Import, and pick this file. Settings and avatars
are restored together.

Importing REPLACES the whole existing configuration.

Only .{ext} files are accepted. If all you have is an old {settings} on
its own, put it in a zip archive under that exact name, rename the
archive to .{ext}, and it will be read normally.
`,
    backupNoticeNoAvatars: '  (no avatar imported at the time of the backup)',
    backupSaved: 'Backup saved.',
    backupSavedWithAvatars: 'Backup saved, with {count} avatar(s).',
    settingsRestored: 'Settings restored.',
    settingsAndAvatarsRestored: 'Settings and {count} avatar(s) restored.',
    avatarImported: '“{name}” imported.',
    importFailed: 'Import failed.',
    importBackground: 'Import an image',
    removeBackground: 'Remove the image',
    importedImage: 'Imported image',
    backupNoticeWallpaper: '  wallpaper/\n      The background image you had imported, as-is.',
    defaultBackground: 'Default',
    noTheme: 'No theme',
    previousAvatar: 'Previous avatar',
    nextAvatar: 'Next avatar',
    close: 'Close',
  },

  catalog: {
    title: 'Add a tile',
    hint: 'Drag a thumbnail onto the grid to drop it there.',
    import: 'Import',
    theme: 'Theme',
    information: 'Information',
    all: 'All',
    noMatch: 'No tile matches these filters.',
    unavailableOnVehicle: 'unavailable on this vehicle',
    nothingImported: 'Nothing imported.',
    importedPlain: '{items} imported.',
    importedFrom: '{items} imported from “{pack}”.',
    andJoiner: 'and',
    cannotRemove: 'This tile is built in and cannot be removed.',
  },

  editor: {
    layout: 'Layout',
    noRoom: 'No room: another tile is in the way.',
    boardFull: 'No room: the board is too crowded.',
    holdForSettings: 'Hold to open the settings.',
    scale: 'Scale',
    layer: 'Layer',
    orientation: 'Orientation',
    normal: 'Normal',
    mirrored: 'Mirrored',
    whenMissing: 'When the value is missing',
    missingOnVehicle: 'This value does not exist on the connected vehicle.',
    missingGeneric: 'On a vehicle that does not provide it.',
    hide: 'Hide',
    keep: 'Keep',
    delete: 'Delete this tile',
    close: 'Close',
    reset: 'Reset size',
    columns: 'Columns',
    rows: 'Rows',
    decrease: 'decrease',
    increase: 'increase',
    tile: 'Tile',
    spacing: 'Spacing',
    spacingAuto: 'Theme',
    dressing: 'Dressing',
    caption: 'Caption',
    captions: {
      show: 'Shown',
      hide: 'Hidden',
      spread: 'Spread out',
    },
    dressings: {
      default: 'Default',
      borderless: 'No border',
      unfilled: 'No fill',
      bare: 'Bare',
      feathered: 'Feathered',
    },
    edges: 'Edges',
    edgeSides: { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' },
    edgeModes: { auto: 'automatic', force: 'forced', off: 'disabled' },
  },

  keyboard: {
    title: 'Keyboard',
    between: 'Between tiles',
    grab: 'Pick up, drop',
    nudge: 'Move one cell',
    resize: 'Resize',
    edit: 'Tile settings',
  },

  editBar: {
    addTile: 'Add a tile',
    exitEditMode: 'Exit edit mode',
    back: 'Back to the previous menu',
    columns: 'Columns',
    columnsShort: 'Col.',
    rows: 'Rows',
    rowsShort: 'Rows',
    add: 'add',
    subtract: 'remove',
    activeLayer: 'Active layer: {layer}. Move to the next one',
  },

  status: {
    disconnected: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: 'Connection error',
  },

  layers: {
    background: 'Background',
    main: 'Main',
    front: 'Front',
  },

  profiles: {
    eco: 'Eco',
    normal: 'Normal',
    sporty: 'Sporty',
    aggressive: 'Aggressive',
  },

  metrics: {
    speed: 'Speed',
    rpm: 'Engine speed',
    gear: 'Gear',
    throttle: 'Throttle',
    boost: 'Boost',
    consumption: 'Instant consumption',
    consumptionRate: 'Hourly consumption',
    engineLoad: 'Engine load',
    coolant: 'Temperature',
    maf: 'Air flow',
    lateralG: 'Lateral G',
    longitudinalG: 'Longitudinal G',
    tripDistance: 'Trip distance',
    tripAverage: 'Trip average',
    tripDuration: 'Trip duration',
    avatar: 'Avatar',
  },

  categories: {
    driving: 'Driving',
    engine: 'Engine',
    consumption: 'Consumption',
    trip: 'Trip',
    character: 'Character',
  },

  avatars: {
    neonFaceLabel: 'Neon face',
    neonFaceDescription: 'Glowing face and HUD widgets, drawn by code.',
    plushLabel: 'Plush companion',
    plushDescription: 'A small rounded companion, modelled by code.',
  },

  driveModes: {
    eco: 'Eco',
    normal: 'Normal',
    sport: 'Sport',
  },
  calibration: {
    title: 'Calibration',
    done: 'Calibrated',
    declareModes: 'Which driving modes does this vehicle offer?',
    noModesHint: 'Tick none if it has no mode selector. Everything else is still measured.',
    start: 'Start',
    next: 'Next step',
    skip: 'Skip this step',
    stepOf: 'Step {index} of {total}',
    driveInMode: 'Drive in {mode}',
    phases: {
      warmup: 'Warm the engine up',
      idle: 'Let it idle, stopped',
      drive: 'Drive normally',
      done: 'Finished',
    },
    hints: {
      warmup: 'Waiting for the coolant to come up to temperature.',
      idle: 'Handbrake on, foot off the pedal.',
      drive: 'Mixed roads, a few gears, a few pedal positions.',
    },
    idle: 'Idle speed',
    redline: 'Redline',
    topSpeed: 'Speedometer scale',
    turbo: 'Forced induction',
    modesLearned: 'Modes learned',
    measured: 'measured',
    inferred: 'inferred',
    notMeasured: 'not measured',
    modesTooClose: 'The modes behave too much alike to be told apart afterwards. Everything else has been kept.',
    yes: 'Yes',
    no: 'No',
    apply: 'Apply',
    export: 'Export',
    openFromSettings: 'Calibrate on this vehicle',
    never: 'This vehicle has never been calibrated.',
    lastRun: 'Calibrated on {date}',
    recalibrate: 'Run again',
    aged: 'Calibrated {days} days ago, {count} trips back.',
    revsBeyond: 'Your trips have since reached {rpm} rpm, above the calibrated redline.',
    adoptRedline: 'Adopt {rpm} rpm',
    forget: 'Forget',
    modesNone: 'No mode',
  },
  transfer: {
    title: 'Import / Export',
    kinds: {
      people: 'person',
      vehicles: 'vehicle',
      appearances: 'look',
    },
    drop: 'Drop a {kind} file here, or tap to choose one.',
    scope: 'Only a {kind} can be imported here. It is added to the list, nothing is replaced.',
    export: 'Export {name}',
    added: '{name} added.',
  },
  errors: {
    unreadableArchive: 'Archive unreadable.',
    notABackup: 'This file is not a TachSync backup.',
    incompleteArchive: 'Incomplete archive: {name} is missing.',
    invalidJson: 'Unreadable file: this is not valid JSON.',
    unexpectedObject: 'Unexpected file: a settings object was expected.',
    foreignBackup: 'This file is not a TachSync backup (“{format}”).',
    unknownAvatarFormat: 'Unrecognised format (“.{ext}”). Expected: .riv, .glb or .gltf.',
    avatarTooLarge: 'File too large ({size} MB). Limit: 64 MB.',
    notAnImage: 'This file is not an image!',
    imageTooLarge: 'Image too heavy: {size} MB (max 16).',
    noTilesFound: 'No tile or background found in this file.',
    storageUnavailable: 'Storage unavailable.',
    notAnEntity: 'This file was not exported from TachSync.',
    wrongEntityKind: 'This file does not hold a {kind}.',
    unreadableAvatarFile: 'Avatar file could not be read.',
    notRiveDocument: 'This file is not a Rive document.',
    riveDecodeFailed: 'Rive could not decode this file.',
    riveNoStateMachine: 'This Rive file has no state machine, so nothing can be animated.',
    notGltfModel: 'This file is not a binary glTF model.',
    gltfDecodeFailed: 'This model could not be decoded.',
  },
};
