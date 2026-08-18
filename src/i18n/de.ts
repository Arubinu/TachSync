import type { Translation } from './types';

export const de: Translation = {
  languageName: 'Deutsch',
  roadRules: 'Auf öffentlichen Straßen gilt zuerst die Straßenverkehrsordnung. Diese Anwendung rechtfertigt keinen Verstoß, und kein Schritt der Kalibrierung verlangt einen.',

  terms: {
    title: 'Vor der Fahrt',
    lead: 'Diese Anwendung zeigt an. Sie fährt nicht.',
    driver: 'Du allein bist für deine Fahrweise, dein Fahrzeug und alle um dich herum verantwortlich. Nichts von dem, was hier angezeigt wird, nimmt dir das ab.',
    law: 'Die Straßenverkehrsordnung gilt immer zuerst. Keine Anzeige und kein Schritt der Kalibrierung rechtfertigt es, ein Limit zu überschreiten oder ein Risiko einzugehen.',
    attention: 'Der Bildschirm wird im Vorbeischauen gelesen, nie während der Fahrt bedient. Während einer Aufzeichnung oder Kalibrierung lass deinen Beifahrer tippen.',
    noWarranty: 'Die Werte stammen aus deinem Fahrzeug und können falsch, verspätet oder gar nicht vorhanden sein. Verlass dich nie darauf, wo die Sicherheit davon abhängt. Ohne jede Gewähr bereitgestellt.',
    accept: 'Verstanden und akzeptiert',
  },
  connect: {
    nearbyAdapters: 'Adapter in der Nähe',
    obdAdapter: 'OBD-II-Adapter',
    bluetoothUnavailable: 'Bluetooth nicht verfügbar',
    chooserHint:
      'Der Browser zeigt die Geräteliste selbst an: Er lässt eine Seite dein Bluetooth nicht durchsuchen.',
    chooseAdapter: 'Adapter auswählen',
    searching: 'Suche…',
    noAdapter: 'Kein Adapter gefunden.',
    searchInProgress: 'Suche läuft',
    selectionInterrupted: 'Auswahl abgebrochen.',
    scanFailed: 'Suche nicht möglich.',
    continueWithout: 'Ohne Adapter fortfahren',
    simulatedData: 'Simulierte Daten',
    changeLanguage: 'Sprache wechseln',
  },

  capture: {
    title: 'OBD-Aufzeichnung',
    safety: 'Lass deinen Beifahrer tippen. Bediene den Bildschirm nie während der Fahrt.',
    progress: 'Schritt {index} von {total}',
    next: 'Nächster Schritt',
    finish: 'Beenden',
    done: 'Aufzeichnung abgeschlossen.',
    export: 'Protokoll exportieren',
    steps: {
      ignition: 'Zündung an, Motor aus. Lass den Adapter hochfahren.',
      idle: 'Motor starten und im Leerlauf laufen lassen.',
      gentleAccel: 'Sanft auf etwa 50 km/h beschleunigen und halten.',
      firmAccel: 'Kräftig über zwei Schaltvorgänge beschleunigen.',
      liftOff: 'Vom Gas gehen und die Motorbremse wirken lassen.',
      hardBrake: 'Kräftig bremsen, wo es gefahrlos möglich ist.',
      cornerLeft: 'Eine enge Linkskurve fahren.',
      cornerRight: 'Eine enge Rechtskurve fahren.',
      cruise: 'Eine Minute lang 80–90 km/h halten.',
      shutdown: 'Anhalten, kurz im Leerlauf laufen lassen, dann ausschalten.',
    },
  },

  discovery: {
    insecureContext:
      'Bluetooth erfordert eine sichere Verbindung. Öffne die Seite über HTTPS oder installiere die App.',
    webView:
      'Diese eingebettete Ansicht hat keinen Bluetooth-Zugriff. Öffne die Seite in Chrome oder installiere die App.',
    unsupportedBrowser: 'Dieser Browser unterstützt kein Bluetooth. Chrome unter Android schon.',
    nativePending:
      'Bluetooth ist in dieser Version der App noch nicht angebunden. Nutze so lange den Simulator.',
  },

  settings: {
    title: 'Einstellungen',
    lightOn: 'Helles Design',
    lightOff: 'Dunkles Design',
    profiles: 'Profile',
    person: 'Person',
    vehicleProfile: 'Fahrzeug',
    look: 'Aussehen',
    profileName: 'Umbenennen',
    vehicleDetected: 'Neues Fahrzeug erkannt',
    nameHint: 'Tippen, um es zu benennen — oder später in den Profileinstellungen.',
    topSpeed: 'Höchstgeschwindigkeit',
    redline: 'Drehzahlgrenze',
    duplicate: 'Duplizieren',
    newProfile: 'Neu',
    appearance: 'Darstellung',
    background: 'Hintergrund',
    avatar: 'Avatar',
    textScale: 'Textgröße',
    language: 'Sprache',
    simulator: 'Simulator',
    calibration: 'Kalibrierung',
    drivingStyle: 'Fahrstil',
    vehicle: 'Fahrzeug',
    board: 'Anzeige',
    landscape: 'Querformat',
    portrait: 'Hochformat',
    editMode: 'Bearbeitungsmodus',
    resetTrip: 'Fahrt zurücksetzen',
    imports: 'Importe',
    delete: 'Löschen',
    tilesCount: 'Kachel(n)',
    backgroundsCount: 'Hintergrund/Hintergründe',
    trips: 'Fahrten',
    noTrips: 'Noch keine Fahrt aufgezeichnet.',
    clearTrips: 'Alle löschen',
    useTripHistory: 'Meine Fahrten als Maßstab nehmen',
    useTripHistoryOn: 'An',
    useTripHistoryOff: 'Aus',
    baselineFrom: 'Aus {count} Fahrten gelesen. Dein gewöhnliches Fahren bestimmt, wo „sportlich“ beginnt.',
    baselineTooFew: 'Es braucht {count} Fahrten mit diesem Fahrzeug, bevor sich etwas sagen lässt.',
    backup: 'Sicherung',
    export: 'Exportieren',
    import: 'Importieren',
    remove: 'Entfernen',
    backupHint:
      'Einstellungen und Avatare in einer einzigen .{ext}-Datei. Alles liegt in diesem Browser; ein Import ersetzt alles.',
    backupWarning: 'Beim Import wird alles zurückgesetzt!',
    backupNotice: `TACHSYNC-SICHERUNG
==================

Diese Datei ist ein gewöhnliches ZIP-ARCHIV mit einer anwendungseigenen
Endung. Um sie mit dem Werkzeug deines Systems zu öffnen, benenne sie in
.zip um — mehr ist nicht nötig.

INHALT
------

  {settings}
      Deine Einstellungen als eingerücktes JSON: Kachelanordnung je
      Ausrichtung, importierte Kacheln und Hintergründe, gewählter
      Avatar, Textskalierung. In jedem Texteditor lesbar und änderbar.

  {avatars}
      Die von dir importierten Avatardateien, unverändert (.riv, .glb
      oder .gltf). Sie passen nicht in die Einstellungsdatei: es sind
      Binärdateien von mehreren Megabyte.

{list}{wallpaper}

  {readme}
      Dieser Hinweis.

WIEDERHERSTELLEN
----------------

Einstellungen -> Sicherung -> Importieren, und diese Datei auswählen.
Einstellungen und Avatare werden gemeinsam wiederhergestellt.

Der Import ERSETZT die gesamte bestehende Konfiguration.

Nur .{ext}-Dateien werden angenommen. Hast du nur eine alte, einzelne
{settings}, lege sie unter genau diesem Namen in ein Zip-Archiv, benenne
das Archiv in .{ext} um, und es wird normal gelesen.
`,
    backupNoticeNoAvatars: '  (zum Zeitpunkt der Sicherung kein Avatar importiert)',
    backupSaved: 'Sicherung gespeichert.',
    backupSavedWithAvatars: 'Sicherung gespeichert, mit {count} Avatar(en).',
    settingsRestored: 'Einstellungen wiederhergestellt.',
    settingsAndAvatarsRestored: 'Einstellungen und {count} Avatar(e) wiederhergestellt.',
    avatarImported: '„{name}“ importiert.',
    importFailed: 'Import nicht möglich.',
    importBackground: 'Bild importieren',
    removeBackground: 'Bild entfernen',
    importedImage: 'Importiertes Bild',
    backupNoticeWallpaper: '  wallpaper/\n      Das importierte Hintergrundbild, unverändert.',
    defaultBackground: 'Standard',
    noTheme: 'Ohne Thema',
    previousAvatar: 'Vorheriger Avatar',
    nextAvatar: 'Nächster Avatar',
    close: 'Schließen',
  },

  catalog: {
    title: 'Kachel hinzufügen',
    hint: 'Zieh ein Vorschaubild auf das Raster, um es dort abzulegen.',
    import: 'Importieren',
    theme: 'Thema',
    information: 'Informationen',
    all: 'Alle',
    noMatch: 'Keine Kachel entspricht diesen Filtern.',
    unavailableOnVehicle: 'bei diesem Fahrzeug nicht verfügbar',
    nothingImported: 'Nichts importiert.',
    importedPlain: '{items} importiert.',
    importedFrom: '{items} aus „{pack}“ importiert.',
    andJoiner: 'und',
    cannotRemove: 'Diese Kachel ist mitgeliefert und kann nicht entfernt werden.',
  },

  editor: {
    layout: 'Anordnung',
    noRoom: 'Kein Platz: eine andere Kachel steht im Weg.',
    boardFull: 'Kein Platz: die Anzeige ist zu voll.',
    holdForSettings: 'Gedrückt halten, um die Einstellungen zu öffnen.',
    scale: 'Größe',
    layer: 'Ebene',
    orientation: 'Ausrichtung',
    normal: 'Normal',
    mirrored: 'Gespiegelt',
    whenMissing: 'Wenn der Wert fehlt',
    missingOnVehicle: 'Diesen Wert gibt es beim verbundenen Fahrzeug nicht.',
    missingGeneric: 'Bei einem Fahrzeug, das ihn nicht liefert.',
    hide: 'Ausblenden',
    keep: 'Behalten',
    delete: 'Diese Kachel löschen',
    close: 'Schließen',
    reset: 'Ursprüngliche Größe',
    columns: 'Spalten',
    rows: 'Zeilen',
    decrease: 'verringern',
    increase: 'erhöhen',
    tile: 'Kachel',
    spacing: 'Abstand',
    spacingAuto: 'Thema',
    dressing: 'Aufmachung',
    caption: 'Beschriftung',
    captions: {
      show: 'Sichtbar',
      hide: 'Versteckt',
      spread: 'Ausgebreitet',
    },
    dressings: {
      default: 'Standard',
      borderless: 'Ohne Rahmen',
      unfilled: 'Ohne Füllung',
      bare: 'Ohne beides',
      feathered: 'Weiche Kante',
    },
    edges: 'Ränder',
    edgeSides: { top: 'Oben', right: 'Rechts', bottom: 'Unten', left: 'Links' },
    edgeModes: { auto: 'automatisch', force: 'erzwungen', off: 'deaktiviert' },
  },

  keyboard: {
    title: 'Tastatur',
    between: 'Zwischen Kacheln',
    grab: 'Aufnehmen, ablegen',
    nudge: 'Eine Zelle bewegen',
    resize: 'Größe ändern',
    edit: 'Kacheleinstellungen',
  },

  editBar: {
    addTile: 'Kachel hinzufügen',
    exitEditMode: 'Bearbeitungsmodus verlassen',
    back: 'Zurück zum vorherigen Menü',
    columns: 'Spalten',
    columnsShort: 'Sp.',
    rows: 'Zeilen',
    rowsShort: 'Z.',
    add: 'erhöhen',
    subtract: 'verringern',
    activeLayer: 'Aktive Ebene: {layer}. Zur nächsten wechseln',
  },

  status: {
    disconnected: 'Getrennt',
    connecting: 'Verbinde…',
    connected: 'Verbunden',
    error: 'Verbindungsfehler',
  },

  layers: {
    background: 'Hintergrund',
    main: 'Haupt',
    front: 'Vorne',
  },

  profiles: {
    eco: 'Eco',
    normal: 'Normal',
    sporty: 'Sportlich',
    aggressive: 'Aggressiv',
  },

  metrics: {
    speed: 'Geschwindigkeit',
    rpm: 'Drehzahl',
    gear: 'Gang',
    throttle: 'Gaspedal',
    boost: 'Ladedruck',
    consumption: 'Momentanverbrauch',
    consumptionRate: 'Stundenverbrauch',
    engineLoad: 'Motorlast',
    coolant: 'Temperatur',
    maf: 'Luftmasse',
    lateralG: 'Querbeschleunigung',
    longitudinalG: 'Längsbeschleunigung',
    tripDistance: 'Fahrtstrecke',
    tripAverage: 'Fahrtdurchschnitt',
    tripDuration: 'Fahrtdauer',
    avatar: 'Avatar',
  },

  categories: {
    driving: 'Fahren',
    engine: 'Motor',
    consumption: 'Verbrauch',
    trip: 'Fahrt',
    character: 'Figur',
  },

  avatars: {
    neonFaceLabel: 'Neon-Gesicht',
    neonFaceDescription: 'Leuchtendes Gesicht und HUD-Elemente, per Code gezeichnet.',
    plushLabel: 'Plüsch-Begleiter',
    plushDescription: 'Kleiner runder Begleiter, per Code modelliert.',
  },

  driveModes: {
    eco: 'Eco',
    normal: 'Normal',
    sport: 'Sport',
  },
  calibration: {
    title: 'Kalibrierung',
    done: 'Kalibriert',
    declareModes: 'Welche Fahrmodi bietet dieses Fahrzeug?',
    noModesHint: 'Keinen ankreuzen, wenn es keinen Schalter hat. Alles übrige wird trotzdem gemessen.',
    start: 'Starten',
    next: 'Nächster Schritt',
    skip: 'Schritt überspringen',
    stepOf: 'Schritt {index} von {total}',
    driveInMode: 'Fahre in {mode}',
    phases: {
      warmup: 'Motor warmfahren',
      idle: 'Im Stand im Leerlauf laufen lassen',
      drive: 'Normal fahren',
      done: 'Fertig',
    },
    hints: {
      warmup: 'Es wird auf die Kühlmitteltemperatur gewartet.',
      idle: 'Handbremse angezogen, Fuß vom Pedal.',
      drive: 'Gemischte Strecken, mehrere Gänge, mehrere Pedalstellungen.',
    },
    idle: 'Leerlaufdrehzahl',
    redline: 'Drehzahlbegrenzer',
    topSpeed: 'Tachoskala',
    turbo: 'Aufladung',
    modesLearned: 'Gelernte Modi',
    measured: 'gemessen',
    inferred: 'abgeleitet',
    notMeasured: 'nicht gemessen',
    modesTooClose: 'Die Modi verhalten sich zu ähnlich, um sie später zu unterscheiden. Alles übrige wurde behalten.',
    yes: 'Ja',
    no: 'Nein',
    apply: 'Übernehmen',
    export: 'Exportieren',
    openFromSettings: 'Auf dieses Fahrzeug kalibrieren',
    never: 'Dieses Fahrzeug wurde nie kalibriert.',
    lastRun: 'Kalibriert am {date}',
    recalibrate: 'Erneut starten',
    aged: 'Vor {days} Tagen kalibriert, {count} Fahrten zurück.',
    revsBeyond: 'Deine Fahrten haben seither {rpm} min⁻¹ erreicht, oberhalb des kalibrierten Begrenzers.',
    adoptRedline: '{rpm} min⁻¹ übernehmen',
    forget: 'Verwerfen',
    modesNone: 'Kein Modus',
  },
  transfer: {
    title: 'Importieren / Exportieren',
    kinds: {
      people: 'Person',
      vehicles: 'Fahrzeug',
      appearances: 'Erscheinungsbild',
    },
    drop: 'Lege hier eine Datei mit {kind} ab, oder tippe, um eine auszuwählen.',
    scope: 'Hier kann nur {kind} importiert werden. Es kommt zur Liste hinzu, nichts wird ersetzt.',
    export: '{name} exportieren',
    added: '{name} hinzugefügt.',
  },
  errors: {
    unreadableArchive: 'Archiv nicht lesbar.',
    notABackup: 'Diese Datei ist keine TachSync-Sicherung.',
    incompleteArchive: 'Unvollständiges Archiv: {name} fehlt.',
    invalidJson: 'Datei nicht lesbar: kein gültiges JSON.',
    unexpectedObject: 'Unerwartete Datei: ein Einstellungsobjekt wurde erwartet.',
    foreignBackup: 'Diese Datei ist keine TachSync-Sicherung („{format}“).',
    unknownAvatarFormat: 'Format nicht erkannt („.{ext}“). Erwartet: .riv, .glb oder .gltf.',
    avatarTooLarge: 'Datei zu groß ({size} MB). Grenze: 64 MB.',
    notAnImage: 'Diese Datei ist kein Bild!',
    imageTooLarge: 'Bild zu groß: {size} MB (max. 16).',
    noTilesFound: 'Keine Kachel und kein Hintergrund in dieser Datei gefunden.',
    storageUnavailable: 'Speicher nicht verfügbar.',
    notAnEntity: 'Diese Datei stammt nicht aus TachSync.',
    wrongEntityKind: 'Diese Datei enthält kein {kind}.',
    unreadableAvatarFile: 'Die Avatar-Datei konnte nicht gelesen werden.',
    notRiveDocument: 'Diese Datei ist kein Rive-Dokument.',
    riveDecodeFailed: 'Rive konnte diese Datei nicht dekodieren.',
    riveNoStateMachine: 'Diese Rive-Datei hat keine Zustandsmaschine, es gibt also nichts zu animieren.',
    notGltfModel: 'Diese Datei ist kein binäres glTF-Modell.',
    gltfDecodeFailed: 'Dieses Modell konnte nicht dekodiert werden.',
  },
};
