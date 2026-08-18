import type { Translation } from './types';

export const it: Translation = {
  languageName: 'Italiano',
  roadRules: 'Sulla strada pubblica vale prima di tutto il codice della strada. Questa applicazione non giustifica alcuna infrazione, e nessun passo della calibrazione ne richiede una.',

  terms: {
    title: 'Prima di guidare',
    lead: 'Questa applicazione mostra. Non guida.',
    driver: 'Sei l’unico responsabile della tua guida, del tuo veicolo e di chi ti sta intorno. Nulla di quanto compare qui te ne solleva, in nessun momento.',
    law: 'Il codice della strada viene sempre prima. Nessuna lettura e nessun passo della calibrazione giustifica superare un limite o correre un rischio.',
    attention: 'Lo schermo si legge con un’occhiata, mai manipolandolo alla guida. Durante una registrazione o una calibrazione, lascia fare al tuo passeggero.',
    noWarranty: 'I valori vengono dal tuo veicolo e possono essere errati, in ritardo o assenti. Non fidartene mai dove ne dipende la sicurezza. Fornito così com’è, senza garanzia.',
    accept: 'Ho capito e accetto',
  },
  connect: {
    nearbyAdapters: 'Adattatori nelle vicinanze',
    obdAdapter: 'Adattatore OBD-II',
    bluetoothUnavailable: 'Bluetooth non disponibile',
    chooserHint:
      'Il browser mostra da sé l’elenco dei dispositivi: non permette a una pagina di inventariare il tuo Bluetooth.',
    chooseAdapter: 'Scegli un adattatore',
    searching: 'Ricerca…',
    noAdapter: 'Nessun adattatore trovato.',
    searchInProgress: 'Ricerca in corso',
    selectionInterrupted: 'Selezione interrotta.',
    scanFailed: 'Ricerca non riuscita.',
    continueWithout: 'Continua senza adattatore',
    simulatedData: 'Dati simulati',
    changeLanguage: 'Cambia lingua',
  },

  capture: {
    title: 'Registrazione OBD',
    safety: 'Lascia fare al tuo passeggero. Non usare lo schermo mentre guidi.',
    progress: 'Passo {index} di {total}',
    next: 'Passo successivo',
    finish: 'Termina',
    done: 'Registrazione completata.',
    export: 'Esporta il registro',
    steps: {
      ignition: 'Quadro acceso, motore spento. Lascia avviare l’adattatore.',
      idle: 'Avvia il motore e lascialo al minimo.',
      gentleAccel: 'Accelera dolcemente fino a circa 50 km/h e mantieni.',
      firmAccel: 'Accelera con decisione attraverso due cambi di marcia.',
      liftOff: 'Rilascia il gas e lascia agire il freno motore.',
      hardBrake: 'Frena con decisione, dove è sicuro farlo.',
      cornerLeft: 'Affronta una curva stretta a sinistra.',
      cornerRight: 'Affronta una curva stretta a destra.',
      cruise: 'Mantieni 80–90 km/h per un minuto.',
      shutdown: 'Accosta, lascia al minimo un istante, poi spegni.',
    },
  },

  discovery: {
    insecureContext:
      'Il Bluetooth richiede una connessione sicura. Apri il sito in HTTPS o installa l’applicazione.',
    webView:
      'Questa vista integrata non dà accesso al Bluetooth. Apri il sito in Chrome o installa l’applicazione.',
    unsupportedBrowser: 'Questo browser non gestisce il Bluetooth. Chrome su Android sì.',
    nativePending:
      'Il Bluetooth non è ancora collegato in questa versione dell’app. Nel frattempo usa il simulatore.',
  },

  settings: {
    title: 'Impostazioni',
    lightOn: 'Tema chiaro',
    lightOff: 'Tema scuro',
    profiles: 'Profili',
    person: 'Persona',
    vehicleProfile: 'Veicolo',
    look: 'Aspetto',
    profileName: 'Rinomina',
    vehicleDetected: 'Nuovo veicolo rilevato',
    nameHint: 'Tocca per dargli un nome, o fallo più tardi nelle impostazioni dei profili.',
    topSpeed: 'Velocità max',
    redline: 'Limitatore',
    duplicate: 'Duplica',
    newProfile: 'Nuovo',
    appearance: 'Aspetto',
    background: 'Sfondo',
    avatar: 'Avatar',
    textScale: 'Scala del testo',
    language: 'Lingua',
    simulator: 'Simulatore',
    calibration: 'Calibrazione',
    drivingStyle: 'Stile di guida',
    vehicle: 'Veicolo',
    board: 'Cruscotto',
    landscape: 'Orizzontale',
    portrait: 'Verticale',
    editMode: 'Modalità modifica',
    resetTrip: 'Azzera il percorso',
    imports: 'Importazioni',
    delete: 'Elimina',
    tilesCount: 'riquadro/i',
    backgroundsCount: 'sfondo/i',
    trips: 'Viaggi',
    noTrips: 'Nessun viaggio registrato.',
    clearTrips: 'Cancella tutto',
    useTripHistory: 'Basarsi sui miei viaggi',
    useTripHistoryOn: 'Attivo',
    useTripHistoryOff: 'Disattivo',
    baselineFrom: 'Letto da {count} viaggi. La tua guida abituale decide dove inizia «brillante».',
    baselineTooFew: 'Servono {count} viaggi su questo veicolo prima di poter dire qualcosa.',
    backup: 'Backup',
    export: 'Esporta',
    import: 'Importa',
    remove: 'Rimuovi',
    backupHint:
      'Impostazioni e avatar in un unico file .{ext}. Tutto vive in questo browser; l’importazione sostituisce tutto.',
    backupWarning: 'All’importazione viene azzerato tutto!',
    backupNotice: `BACKUP TACHSYNC
===============

Questo file è un normale ARCHIVIO ZIP, con un'estensione propria
dell'applicazione. Per aprirlo con lo strumento del tuo sistema,
rinominalo in .zip — non serve altro.

CONTENUTO
---------

  {settings}
      Le tue impostazioni, in JSON indentato: disposizione dei riquadri
      per orientamento, riquadri e sfondi importati, avatar scelto,
      scala del testo. Leggibile e modificabile in qualsiasi editor.

  {avatars}
      I file di avatar che avevi importato, così come sono (.riv, .glb
      o .gltf). Non entrano nel file di impostazioni: sono binari di
      diversi megabyte.

{list}{wallpaper}

  {readme}
      Questa nota.

RIPRISTINARE
------------

Impostazioni -> Backup -> Importa, e scegli questo file. Impostazioni e
avatar vengono ripristinati insieme.

L'importazione SOSTITUISCE l'intera configurazione esistente.

Sono accettati solo i file .{ext}. Se hai solo un vecchio {settings}
isolato, mettilo in un archivio zip con quel nome esatto, rinomina
l'archivio in .{ext} e verrà letto normalmente.
`,
    backupNoticeNoAvatars: '  (nessun avatar importato al momento del backup)',
    backupSaved: 'Backup salvato.',
    backupSavedWithAvatars: 'Backup salvato, con {count} avatar.',
    settingsRestored: 'Impostazioni ripristinate.',
    settingsAndAvatarsRestored: 'Impostazioni e {count} avatar ripristinati.',
    avatarImported: '«{name}» importato.',
    importFailed: 'Importazione non riuscita.',
    importBackground: 'Importa un’immagine',
    removeBackground: 'Rimuovi l’immagine',
    importedImage: 'Immagine importata',
    backupNoticeWallpaper: '  wallpaper/\n      L’immagine di sfondo che avevi importato, così com’è.',
    defaultBackground: 'Predefinito',
    noTheme: 'Senza tema',
    previousAvatar: 'Avatar precedente',
    nextAvatar: 'Avatar successivo',
    close: 'Chiudi',
  },

  catalog: {
    title: 'Aggiungi un riquadro',
    hint: 'Trascina una miniatura sulla griglia per posarla.',
    import: 'Importa',
    theme: 'Tema',
    information: 'Informazioni',
    all: 'Tutte',
    noMatch: 'Nessun riquadro corrisponde a questi filtri.',
    unavailableOnVehicle: 'non disponibile su questo veicolo',
    nothingImported: 'Niente importato.',
    importedPlain: '{items} importato/i.',
    importedFrom: '{items} importato/i da «{pack}».',
    andJoiner: 'e',
    cannotRemove: 'Questo riquadro è nativo e non può essere rimosso.',
  },

  editor: {
    layout: 'Disposizione',
    noRoom: 'Spazio insufficiente: un altro riquadro occupa il posto.',
    boardFull: 'Spazio insufficiente: il cruscotto è troppo pieno.',
    holdForSettings: 'Tieni premuto per aprire le impostazioni.',
    scale: 'Scala',
    layer: 'Livello',
    orientation: 'Orientamento',
    normal: 'Normale',
    mirrored: 'Speculare',
    whenMissing: 'Se il valore manca',
    missingOnVehicle: 'Questo valore non esiste sul veicolo collegato.',
    missingGeneric: 'Su un veicolo che non lo fornisce.',
    hide: 'Nascondi',
    keep: 'Mantieni',
    delete: 'Elimina questo riquadro',
    close: 'Chiudi',
    reset: 'Dimensione originale',
    columns: 'Colonne',
    rows: 'Righe',
    decrease: 'riduci',
    increase: 'aumenta',
    tile: 'Riquadro',
    spacing: 'Spaziatura',
    spacingAuto: 'Tema',
    dressing: 'Finitura',
    caption: 'Didascalia',
    captions: {
      show: 'Visibile',
      hide: 'Nascosta',
      spread: 'Espansa',
    },
    dressings: {
      default: 'Predefinito',
      borderless: 'Senza bordo',
      unfilled: 'Senza sfondo',
      bare: 'Senza nulla',
      feathered: 'Sfumato',
    },
    edges: 'Bordi',
    edgeSides: { top: 'Alto', right: 'Destra', bottom: 'Basso', left: 'Sinistra' },
    edgeModes: { auto: 'automatico', force: 'forzato', off: 'disattivato' },
  },

  keyboard: {
    title: 'Tastiera',
    between: 'Tra i riquadri',
    grab: 'Afferrare, rilasciare',
    nudge: 'Spostare di una cella',
    resize: 'Ridimensionare',
    edit: 'Impostazioni riquadro',
  },

  editBar: {
    addTile: 'Aggiungi un riquadro',
    exitEditMode: 'Esci dalla modalità modifica',
    back: 'Torna al menu precedente',
    columns: 'Colonne',
    columnsShort: 'Col.',
    rows: 'Righe',
    rowsShort: 'Rig.',
    add: 'aumenta',
    subtract: 'riduci',
    activeLayer: 'Livello attivo: {layer}. Passa al successivo',
  },

  status: {
    disconnected: 'Disconnesso',
    connecting: 'Connessione…',
    connected: 'Connesso',
    error: 'Errore di connessione',
  },

  layers: {
    background: 'Sfondo',
    main: 'Principale',
    front: 'Primo piano',
  },

  profiles: {
    eco: 'Eco',
    normal: 'Normale',
    sporty: 'Sportivo',
    aggressive: 'Aggressivo',
  },

  metrics: {
    speed: 'Velocità',
    rpm: 'Regime',
    gear: 'Marcia',
    throttle: 'Acceleratore',
    boost: 'Turbo',
    consumption: 'Consumo istantaneo',
    consumptionRate: 'Consumo orario',
    engineLoad: 'Carico motore',
    coolant: 'Temperatura',
    maf: 'Portata d’aria',
    lateralG: 'G laterale',
    longitudinalG: 'G longitudinale',
    tripDistance: 'Distanza percorso',
    tripAverage: 'Media percorso',
    tripDuration: 'Durata percorso',
    avatar: 'Avatar',
  },

  categories: {
    driving: 'Guida',
    engine: 'Motore',
    consumption: 'Consumo',
    trip: 'Percorso',
    character: 'Personaggio',
  },

  avatars: {
    neonFaceLabel: 'Volto al neon',
    neonFaceDescription: 'Volto luminoso e widget HUD, disegnati dal codice.',
    plushLabel: 'Compagno di peluche',
    plushDescription: 'Piccolo compagno tutto tondo, modellato dal codice.',
  },

  driveModes: {
    eco: 'Eco',
    normal: 'Normale',
    sport: 'Sport',
  },
  calibration: {
    title: 'Calibrazione',
    done: 'Calibrata',
    declareModes: 'Quali modi di guida offre questo veicolo?',
    noModesHint: 'Non selezionarne nessuno se non ha un selettore. Tutto il resto viene misurato lo stesso.',
    start: 'Inizia',
    next: 'Passo successivo',
    skip: 'Salta questo passo',
    stepOf: 'Passo {index} di {total}',
    driveInMode: 'Guida in {mode}',
    phases: {
      warmup: 'Fai scaldare il motore',
      idle: 'Lascialo al minimo, da fermo',
      drive: 'Guida normalmente',
      done: 'Finito',
    },
    hints: {
      warmup: 'In attesa che salga la temperatura del liquido.',
      idle: 'Freno a mano tirato, piede sollevato.',
      drive: 'Strade varie, qualche marcia, qualche posizione del pedale.',
    },
    idle: 'Regime minimo',
    redline: 'Limitatore',
    topSpeed: 'Scala del tachimetro',
    turbo: 'Sovralimentazione',
    modesLearned: 'Modi appresi',
    measured: 'misurato',
    inferred: 'dedotto',
    notMeasured: 'non misurato',
    modesTooClose: 'I modi si somigliano troppo per distinguerli in seguito. Tutto il resto è stato conservato.',
    yes: 'Sì',
    no: 'No',
    apply: 'Applica',
    export: 'Esporta',
    openFromSettings: 'Calibra su questo veicolo',
    never: 'Questo veicolo non è mai stato calibrato.',
    lastRun: 'Calibrata il {date}',
    recalibrate: 'Rilancia',
    aged: 'Calibrata {days} giorni fa, {count} viaggi indietro.',
    revsBeyond: 'I tuoi viaggi hanno poi raggiunto {rpm} giri/min, oltre il limitatore calibrato.',
    adoptRedline: 'Adotta {rpm} giri/min',
    forget: 'Dimentica',
    modesNone: 'Nessun modo',
  },
  transfer: {
    title: 'Importa / Esporta',
    kinds: {
      people: 'persona',
      vehicles: 'veicolo',
      appearances: 'aspetto',
    },
    drop: 'Trascina qui un file di {kind}, o tocca per sceglierne uno.',
    scope: 'Qui si può importare solo {kind}. Si aggiunge all’elenco, nulla viene sostituito.',
    export: 'Esporta {name}',
    added: '{name} aggiunto.',
  },
  errors: {
    unreadableArchive: 'Archivio illeggibile.',
    notABackup: 'Questo file non è un backup TachSync.',
    incompleteArchive: 'Archivio incompleto: manca {name}.',
    invalidJson: 'File illeggibile: non è JSON valido.',
    unexpectedObject: 'File inatteso: era previsto un oggetto di impostazioni.',
    foreignBackup: 'Questo file non è un backup TachSync («{format}»).',
    unknownAvatarFormat: 'Formato non riconosciuto («.{ext}»). Previsto: .riv, .glb o .gltf.',
    avatarTooLarge: 'File troppo pesante ({size} MB). Limite: 64 MB.',
    notAnImage: 'Questo file non è un’immagine!',
    imageTooLarge: 'Immagine troppo pesante: {size} MB (max 16).',
    noTilesFound: 'Nessun riquadro né sfondo trovato in questo file.',
    storageUnavailable: 'Archiviazione non disponibile.',
    notAnEntity: 'Questo file non proviene da TachSync.',
    wrongEntityKind: 'Questo file non contiene {kind}.',
    unreadableAvatarFile: 'Impossibile leggere il file dell’avatar.',
    notRiveDocument: 'Questo file non è un documento Rive.',
    riveDecodeFailed: 'Rive non è riuscito a decodificare questo file.',
    riveNoStateMachine: 'Questo file Rive non ha una macchina a stati: non c’è nulla da animare.',
    notGltfModel: 'Questo file non è un modello glTF binario.',
    gltfDecodeFailed: 'Impossibile decodificare questo modello.',
  },
};
