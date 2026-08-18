import type { Translation } from './types';

export const nl: Translation = {
  languageName: 'Nederlands',
  roadRules: 'Op de openbare weg geldt de wegcode voor alles. Deze applicatie rechtvaardigt geen enkele overtreding, en geen enkele stap van de kalibratie vraagt erom.',

  terms: {
    title: 'Voor je gaat rijden',
    lead: 'Deze applicatie toont. Ze rijdt niet.',
    driver: 'Jij alleen bent verantwoordelijk voor je rijgedrag, je voertuig en iedereen om je heen. Niets van wat hier staat ontslaat je daarvan, op geen enkel moment.',
    law: 'De wegcode gaat altijd voor. Geen enkele aflezing en geen enkele stap van de kalibratie rechtvaardigt een limiet overschrijden of een risico nemen.',
    attention: 'Het scherm lees je in één oogopslag, je bedient het nooit tijdens het rijden. Laat tijdens een opname of kalibratie je passagier het doen.',
    noWarranty: 'De waarden komen uit je voertuig en kunnen fout, te laat of afwezig zijn. Vertrouw er nooit op waar de veiligheid ervan afhangt. Geleverd zoals het is, zonder garantie.',
    accept: 'Ik begrijp het en ga akkoord',
  },
  connect: {
    nearbyAdapters: 'Adapters in de buurt',
    obdAdapter: 'OBD-II-adapter',
    bluetoothUnavailable: 'Bluetooth niet beschikbaar',
    chooserHint:
      'De browser toont de apparatenlijst zelf: hij laat een pagina je bluetooth niet inventariseren.',
    chooseAdapter: 'Kies een adapter',
    searching: 'Zoeken…',
    noAdapter: 'Geen adapter gevonden.',
    searchInProgress: 'Zoeken bezig',
    selectionInterrupted: 'Selectie onderbroken.',
    scanFailed: 'Zoeken niet mogelijk.',
    continueWithout: 'Doorgaan zonder adapter',
    simulatedData: 'Gesimuleerde gegevens',
    changeLanguage: 'Taal wijzigen',
  },

  capture: {
    title: 'OBD-opname',
    safety: 'Laat je passagier het doen. Bedien het scherm nooit tijdens het rijden.',
    progress: 'Stap {index} van {total}',
    next: 'Volgende stap',
    finish: 'Afronden',
    done: 'Opname voltooid.',
    export: 'Logboek exporteren',
    steps: {
      ignition: 'Contact aan, motor uit. Laat de adapter opstarten.',
      idle: 'Start de motor en laat hem stationair draaien.',
      gentleAccel: 'Rustig optrekken tot ongeveer 50 km/u en vasthouden.',
      firmAccel: 'Stevig optrekken door twee schakelmomenten heen.',
      liftOff: 'Gas loslaten en op de motor afremmen.',
      hardBrake: 'Stevig remmen, waar dat veilig kan.',
      cornerLeft: 'Neem een krappe bocht naar links.',
      cornerRight: 'Neem een krappe bocht naar rechts.',
      cruise: 'Houd een minuut lang 80–90 km/u aan.',
      shutdown: 'Stop, laat even stationair draaien en zet af.',
    },
  },

  discovery: {
    insecureContext:
      'Bluetooth vereist een beveiligde verbinding. Open de site via HTTPS of installeer de app.',
    webView:
      'Deze ingesloten weergave heeft geen toegang tot bluetooth. Open de site in Chrome of installeer de app.',
    unsupportedBrowser: 'Deze browser ondersteunt geen bluetooth. Chrome op Android wel.',
    nativePending:
      'Bluetooth is in deze versie van de app nog niet aangesloten. Gebruik zolang de simulator.',
  },

  settings: {
    title: 'Instellingen',
    lightOn: 'Licht thema',
    lightOff: 'Donker thema',
    profiles: 'Profielen',
    person: 'Persoon',
    vehicleProfile: 'Voertuig',
    look: 'Uiterlijk',
    profileName: 'Hernoemen',
    vehicleDetected: 'Nieuw voertuig gevonden',
    nameHint: 'Tik om het een naam te geven, of doe het later bij de profielinstellingen.',
    topSpeed: 'Topsnelheid',
    redline: 'Toerenbegrenzer',
    duplicate: 'Dupliceren',
    newProfile: 'Nieuw',
    appearance: 'Weergave',
    background: 'Achtergrond',
    avatar: 'Avatar',
    textScale: 'Tekstgrootte',
    language: 'Taal',
    simulator: 'Simulator',
    calibration: 'Kalibratie',
    drivingStyle: 'Rijstijl',
    vehicle: 'Voertuig',
    board: 'Dashboard',
    landscape: 'Liggend',
    portrait: 'Staand',
    editMode: 'Bewerkmodus',
    resetTrip: 'Rit opnieuw beginnen',
    imports: 'Importen',
    delete: 'Verwijderen',
    tilesCount: 'tegel(s)',
    backgroundsCount: 'achtergrond(en)',
    trips: 'Ritten',
    noTrips: 'Nog geen rit opgeslagen.',
    clearTrips: 'Alles wissen',
    useTripHistory: 'Mijn ritten als maatstaf nemen',
    useTripHistoryOn: 'Aan',
    useTripHistoryOff: 'Uit',
    baselineFrom: 'Gelezen uit {count} ritten. Jouw gewone rijstijl bepaalt waar „sportief” begint.',
    baselineTooFew: 'Er zijn {count} ritten met dit voertuig nodig voordat er iets te zeggen valt.',
    backup: 'Reservekopie',
    export: 'Exporteren',
    import: 'Importeren',
    remove: 'Weghalen',
    backupHint:
      'Instellingen en avatars in één .{ext}-bestand. Alles staat in deze browser; importeren vervangt alles.',
    backupWarning: 'Bij importeren wordt alles gewist!',
    backupNotice: `TACHSYNC-BACK-UP
================

Dit bestand is een gewoon ZIP-ARCHIEF met een eigen extensie van de
applicatie. Om het met het hulpmiddel van je systeem te openen, hernoem
het naar .zip — meer is niet nodig.

INHOUD
------

  {settings}
      Je instellingen, als ingesprongen JSON: tegelindeling per
      oriëntatie, geïmporteerde tegels en achtergronden, gekozen avatar,
      tekstschaal. Leesbaar en aanpasbaar in elke teksteditor.

  {avatars}
      De avatarbestanden die je had geïmporteerd, ongewijzigd (.riv,
      .glb of .gltf). Ze passen niet in het instellingenbestand: het
      zijn binaire bestanden van meerdere megabytes.

{list}{wallpaper}

  {readme}
      Deze toelichting.

HERSTELLEN
----------

Instellingen -> Back-up -> Importeren, en kies dit bestand. Instellingen
en avatars worden samen hersteld.

Importeren VERVANGT de volledige bestaande configuratie.

Alleen .{ext}-bestanden worden aanvaard. Heb je enkel een oude losse
{settings}, plaats die dan onder precies die naam in een zip-archief,
hernoem het archief naar .{ext}, en het wordt gewoon gelezen.
`,
    backupNoticeNoAvatars: '  (geen avatar geïmporteerd op het moment van de back-up)',
    backupSaved: 'Reservekopie opgeslagen.',
    backupSavedWithAvatars: 'Reservekopie opgeslagen, met {count} avatar(s).',
    settingsRestored: 'Instellingen hersteld.',
    settingsAndAvatarsRestored: 'Instellingen en {count} avatar(s) hersteld.',
    avatarImported: '“{name}” geïmporteerd.',
    importFailed: 'Importeren niet mogelijk.',
    importBackground: 'Afbeelding importeren',
    removeBackground: 'Afbeelding verwijderen',
    importedImage: 'Geïmporteerde afbeelding',
    backupNoticeWallpaper: '  wallpaper/\n      De achtergrondafbeelding die u had geïmporteerd, ongewijzigd.',
    defaultBackground: 'Standaard',
    noTheme: 'Zonder thema',
    previousAvatar: 'Vorige avatar',
    nextAvatar: 'Volgende avatar',
    close: 'Sluiten',
  },

  catalog: {
    title: 'Tegel toevoegen',
    hint: 'Sleep een miniatuur naar het raster om het daar neer te zetten.',
    import: 'Importeren',
    theme: 'Thema',
    information: 'Informatie',
    all: 'Alle',
    noMatch: 'Geen tegel voldoet aan deze filters.',
    unavailableOnVehicle: 'niet beschikbaar op dit voertuig',
    nothingImported: 'Niets geïmporteerd.',
    importedPlain: '{items} geïmporteerd.',
    importedFrom: '{items} geïmporteerd uit “{pack}”.',
    andJoiner: 'en',
    cannotRemove: 'Deze tegel hoort bij de app en kan niet worden weggehaald.',
  },

  editor: {
    layout: 'Indeling',
    noRoom: 'Geen ruimte: een andere tegel staat in de weg.',
    boardFull: 'Geen ruimte: het dashboard is te vol.',
    holdForSettings: 'Houd ingedrukt om de instellingen te openen.',
    scale: 'Schaal',
    layer: 'Laag',
    orientation: 'Oriëntatie',
    normal: 'Normaal',
    mirrored: 'Gespiegeld',
    whenMissing: 'Als de waarde ontbreekt',
    missingOnVehicle: 'Deze waarde bestaat niet op het verbonden voertuig.',
    missingGeneric: 'Op een voertuig dat hem niet levert.',
    hide: 'Verbergen',
    keep: 'Behouden',
    delete: 'Deze tegel verwijderen',
    close: 'Sluiten',
    reset: 'Oorspronkelijke grootte',
    columns: 'Kolommen',
    rows: 'Rijen',
    decrease: 'verlagen',
    increase: 'verhogen',
    tile: 'Tegel',
    spacing: 'Ruimte',
    spacingAuto: 'Thema',
    dressing: 'Opmaak',
    caption: 'Bijschrift',
    captions: {
      show: 'Zichtbaar',
      hide: 'Verborgen',
      spread: 'Uitgespreid',
    },
    dressings: {
      default: 'Standaard',
      borderless: 'Zonder rand',
      unfilled: 'Zonder vulling',
      bare: 'Zonder beide',
      feathered: 'Vervaagd',
    },
    edges: 'Randen',
    edgeSides: { top: 'Boven', right: 'Rechts', bottom: 'Onder', left: 'Links' },
    edgeModes: { auto: 'automatisch', force: 'geforceerd', off: 'uitgeschakeld' },
  },

  keyboard: {
    title: 'Toetsenbord',
    between: 'Tussen tegels',
    grab: 'Oppakken, neerzetten',
    nudge: 'Eén cel verplaatsen',
    resize: 'Formaat wijzigen',
    edit: 'Tegelinstellingen',
  },

  editBar: {
    addTile: 'Tegel toevoegen',
    exitEditMode: 'Bewerkmodus verlaten',
    back: 'Terug naar het vorige menu',
    columns: 'Kolommen',
    columnsShort: 'Kol.',
    rows: 'Rijen',
    rowsShort: 'Rij.',
    add: 'verhogen',
    subtract: 'verlagen',
    activeLayer: 'Actieve laag: {layer}. Naar de volgende',
  },

  status: {
    disconnected: 'Niet verbonden',
    connecting: 'Verbinden…',
    connected: 'Verbonden',
    error: 'Verbindingsfout',
  },

  layers: {
    background: 'Achtergrond',
    main: 'Hoofd',
    front: 'Voorgrond',
  },

  profiles: {
    eco: 'Eco',
    normal: 'Normaal',
    sporty: 'Sportief',
    aggressive: 'Agressief',
  },

  metrics: {
    speed: 'Snelheid',
    rpm: 'Toerental',
    gear: 'Versnelling',
    throttle: 'Gaspedaal',
    boost: 'Turbodruk',
    consumption: 'Momentverbruik',
    consumptionRate: 'Verbruik per uur',
    engineLoad: 'Motorbelasting',
    coolant: 'Temperatuur',
    maf: 'Luchtmassa',
    lateralG: 'Laterale G',
    longitudinalG: 'Longitudinale G',
    tripDistance: 'Ritafstand',
    tripAverage: 'Ritgemiddelde',
    tripDuration: 'Ritduur',
    avatar: 'Avatar',
  },

  categories: {
    driving: 'Rijden',
    engine: 'Motor',
    consumption: 'Verbruik',
    trip: 'Rit',
    character: 'Figuur',
  },

  avatars: {
    neonFaceLabel: 'Neongezicht',
    neonFaceDescription: 'Oplichtend gezicht en HUD-elementen, door code getekend.',
    plushLabel: 'Pluchen metgezel',
    plushDescription: 'Klein rond metgezelletje, door code gemodelleerd.',
  },

  driveModes: {
    eco: 'Eco',
    normal: 'Normaal',
    sport: 'Sport',
  },
  calibration: {
    title: 'Kalibratie',
    done: 'Gekalibreerd',
    declareModes: 'Welke rijmodi heeft dit voertuig?',
    noModesHint: 'Vink er geen aan als hij geen keuzeschakelaar heeft. De rest wordt toch gemeten.',
    start: 'Beginnen',
    next: 'Volgende stap',
    skip: 'Stap overslaan',
    stepOf: 'Stap {index} van {total}',
    driveInMode: 'Rijd in {mode}',
    phases: {
      warmup: 'Laat de motor warmlopen',
      idle: 'Stationair laten draaien, stilstaand',
      drive: 'Rijd normaal',
      done: 'Klaar',
    },
    hints: {
      warmup: 'Wachten tot de koelvloeistof op temperatuur is.',
      idle: 'Handrem aan, voet van het pedaal.',
      drive: 'Gemengde wegen, een paar versnellingen, een paar pedaalstanden.',
    },
    idle: 'Stationair toerental',
    redline: 'Toerenbegrenzer',
    topSpeed: 'Schaal van de snelheidsmeter',
    turbo: 'Drukvulling',
    modesLearned: 'Geleerde modi',
    measured: 'gemeten',
    inferred: 'afgeleid',
    notMeasured: 'niet gemeten',
    modesTooClose: 'De modi lijken te veel op elkaar om ze later te onderscheiden. De rest is bewaard.',
    yes: 'Ja',
    no: 'Nee',
    apply: 'Toepassen',
    export: 'Exporteren',
    openFromSettings: 'Op dit voertuig kalibreren',
    never: 'Dit voertuig is nooit gekalibreerd.',
    lastRun: 'Gekalibreerd op {date}',
    recalibrate: 'Opnieuw',
    aged: '{days} dagen geleden gekalibreerd, {count} ritten terug.',
    revsBeyond: 'Je ritten haalden sindsdien {rpm} tpm, boven de gekalibreerde begrenzer.',
    adoptRedline: '{rpm} tpm overnemen',
    forget: 'Vergeten',
    modesNone: 'Geen modus',
  },
  transfer: {
    title: 'Importeren / Exporteren',
    kinds: {
      people: 'persoon',
      vehicles: 'voertuig',
      appearances: 'uiterlijk',
    },
    drop: 'Zet hier een bestand met {kind} neer, of tik om er een te kiezen.',
    scope: 'Hier kan alleen {kind} worden geïmporteerd. Het komt bij de lijst, niets wordt vervangen.',
    export: '{name} exporteren',
    added: '{name} toegevoegd.',
  },
  errors: {
    unreadableArchive: 'Archief onleesbaar.',
    notABackup: 'Dit bestand is geen TachSync-reservekopie.',
    incompleteArchive: 'Onvolledig archief: {name} ontbreekt.',
    invalidJson: 'Bestand onleesbaar: dit is geen geldige JSON.',
    unexpectedObject: 'Onverwacht bestand: er werd een instellingenobject verwacht.',
    foreignBackup: 'Dit bestand is geen TachSync-reservekopie (“{format}”).',
    unknownAvatarFormat: 'Onbekend formaat (“.{ext}”). Verwacht: .riv, .glb of .gltf.',
    avatarTooLarge: 'Bestand te groot ({size} MB). Limiet: 64 MB.',
    notAnImage: 'Dit bestand is geen afbeelding!',
    imageTooLarge: 'Afbeelding te groot: {size} MB (max. 16).',
    noTilesFound: 'Geen tegel of achtergrond in dit bestand gevonden.',
    storageUnavailable: 'Opslag niet beschikbaar.',
    notAnEntity: 'Dit bestand komt niet uit TachSync.',
    wrongEntityKind: 'Dit bestand bevat geen {kind}.',
    unreadableAvatarFile: 'Het avatarbestand kon niet worden gelezen.',
    notRiveDocument: 'Dit bestand is geen Rive-document.',
    riveDecodeFailed: 'Rive kon dit bestand niet decoderen.',
    riveNoStateMachine: 'Dit Rive-bestand heeft geen toestandsmachine, dus er valt niets te animeren.',
    notGltfModel: 'Dit bestand is geen binair glTF-model.',
    gltfDecodeFailed: 'Dit model kon niet worden gedecodeerd.',
  },
};
