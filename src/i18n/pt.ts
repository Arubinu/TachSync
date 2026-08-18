import type { Translation } from './types';

export const pt: Translation = {
  languageName: 'Português',
  roadRules: 'Na via pública o código da estrada vem primeiro. Esta aplicação não justifica qualquer infração, e nenhum passo da calibração a exige.',

  terms: {
    title: 'Antes de conduzir',
    lead: 'Esta aplicação mostra. Não conduz.',
    driver: 'És o único responsável pela tua condução, pelo teu veículo e por todos os que te rodeiam. Nada do que aparece aqui te desobriga disso, em momento algum.',
    law: 'O código da estrada vem sempre primeiro. Nenhuma leitura e nenhum passo da calibração justifica exceder um limite ou correr um risco.',
    attention: 'O ecrã lê-se de relance, nunca se manipula a conduzir. Durante uma captura ou uma calibração, deixa o teu passageiro fazê-lo.',
    noWarranty: 'Os valores vêm do teu veículo e podem estar errados, atrasados ou ausentes. Nunca dependas deles onde a segurança esteja em causa. Fornecido tal como está, sem garantia.',
    accept: 'Compreendo e aceito',
  },
  connect: {
    nearbyAdapters: 'Adaptadores próximos',
    obdAdapter: 'Adaptador OBD-II',
    bluetoothUnavailable: 'Bluetooth indisponível',
    chooserHint:
      'O navegador mostra ele próprio a lista de dispositivos: não deixa uma página inventariar o teu Bluetooth.',
    chooseAdapter: 'Escolher um adaptador',
    searching: 'A procurar…',
    noAdapter: 'Nenhum adaptador encontrado.',
    searchInProgress: 'Procura em curso',
    selectionInterrupted: 'Seleção interrompida.',
    scanFailed: 'Não foi possível procurar.',
    continueWithout: 'Continuar sem adaptador',
    simulatedData: 'Dados simulados',
    changeLanguage: 'Mudar de idioma',
  },

  capture: {
    title: 'Captura OBD',
    safety: 'Deixa o teu passageiro fazê-lo. Nunca uses o ecrã a conduzir.',
    progress: 'Passo {index} de {total}',
    next: 'Passo seguinte',
    finish: 'Terminar',
    done: 'Captura concluída.',
    export: 'Exportar o registo',
    steps: {
      ignition: 'Ignição ligada, motor desligado. Deixa o adaptador arrancar.',
      idle: 'Liga o motor e deixa-o ao ralenti.',
      gentleAccel: 'Acelera suavemente até cerca de 50 km/h e mantém.',
      firmAccel: 'Acelera com firmeza ao longo de duas mudanças.',
      liftOff: 'Tira o pé e deixa atuar o travão-motor.',
      hardBrake: 'Trava com firmeza, onde for seguro.',
      cornerLeft: 'Faz uma curva apertada à esquerda.',
      cornerRight: 'Faz uma curva apertada à direita.',
      cruise: 'Mantém 80–90 km/h durante um minuto.',
      shutdown: 'Encosta, deixa ao ralenti um momento e desliga.',
    },
  },

  discovery: {
    insecureContext:
      'O Bluetooth exige uma ligação segura. Abre o site em HTTPS ou instala a aplicação.',
    webView:
      'Esta vista integrada não dá acesso ao Bluetooth. Abre o site no Chrome ou instala a aplicação.',
    unsupportedBrowser: 'Este navegador não suporta Bluetooth. O Chrome no Android suporta.',
    nativePending:
      'O Bluetooth ainda não está ligado nesta versão da aplicação. Usa o simulador entretanto.',
  },

  settings: {
    title: 'Definições',
    lightOn: 'Tema claro',
    lightOff: 'Tema escuro',
    profiles: 'Perfis',
    person: 'Pessoa',
    vehicleProfile: 'Veículo',
    look: 'Aspeto',
    profileName: 'Renomear',
    vehicleDetected: 'Novo veículo detetado',
    nameHint: 'Toque para lhe dar um nome, ou faça-o mais tarde nas definições de perfis.',
    topSpeed: 'Velocidade máx.',
    redline: 'Corte',
    duplicate: 'Duplicar',
    newProfile: 'Novo',
    appearance: 'Aspeto',
    background: 'Fundo',
    avatar: 'Avatar',
    textScale: 'Escala do texto',
    language: 'Idioma',
    simulator: 'Simulador',
    calibration: 'Calibração',
    drivingStyle: 'Estilo de condução',
    vehicle: 'Veículo',
    board: 'Painel',
    landscape: 'Horizontal',
    portrait: 'Vertical',
    editMode: 'Modo de edição',
    resetTrip: 'Reiniciar o percurso',
    imports: 'Importações',
    delete: 'Eliminar',
    tilesCount: 'mosaico(s)',
    backgroundsCount: 'fundo(s)',
    trips: 'Percursos',
    noTrips: 'Nenhum percurso registado.',
    clearTrips: 'Apagar tudo',
    useTripHistory: 'Basear-me nos meus percursos',
    useTripHistoryOn: 'Ativado',
    useTripHistoryOff: 'Desativado',
    baselineFrom: 'Lido de {count} percursos. A tua condução habitual decide onde começa «desportivo».',
    baselineTooFew: 'São precisos {count} percursos neste veículo antes de se poder dizer algo.',
    backup: 'Cópia de segurança',
    export: 'Exportar',
    import: 'Importar',
    remove: 'Retirar',
    backupHint:
      'Definições e avatares num único ficheiro .{ext}. Tudo vive neste navegador; importar substitui tudo.',
    backupWarning: 'Ao importar, tudo é reposto!',
    backupNotice: `CÓPIA DE SEGURANÇA TACHSYNC
===========================

Este ficheiro é um ARQUIVO ZIP comum, com uma extensão própria da
aplicação. Para o abrir com a ferramenta do teu sistema, muda-lhe o nome
para .zip — não é preciso mais nada.

CONTEÚDO
--------

  {settings}
      As tuas definições, em JSON indentado: disposição dos mosaicos por
      orientação, mosaicos e fundos importados, avatar escolhido, escala
      do texto. Legível e editável em qualquer editor de texto.

  {avatars}
      Os ficheiros de avatar que tinhas importado, tal como estão (.riv,
      .glb ou .gltf). Não cabem no ficheiro de definições: são binários
      de vários megabytes.

{list}{wallpaper}

  {readme}
      Este aviso.

RESTAURAR
---------

Definições -> Cópia de segurança -> Importar, e escolhe este ficheiro.
As definições e os avatares são restaurados em conjunto.

A importação SUBSTITUI toda a configuração existente.

Só são aceites ficheiros .{ext}. Se só tiveres um antigo {settings}
isolado, coloca-o num arquivo zip com esse nome exato, muda o nome do
arquivo para .{ext}, e será lido normalmente.
`,
    backupNoticeNoAvatars: '  (nenhum avatar importado no momento da cópia)',
    backupSaved: 'Cópia guardada.',
    backupSavedWithAvatars: 'Cópia guardada, com {count} avatar(es).',
    settingsRestored: 'Definições restauradas.',
    settingsAndAvatarsRestored: 'Definições e {count} avatar(es) restaurados.',
    avatarImported: '«{name}» importado.',
    importFailed: 'Não foi possível importar.',
    importBackground: 'Importar uma imagem',
    removeBackground: 'Remover a imagem',
    importedImage: 'Imagem importada',
    backupNoticeWallpaper: '  wallpaper/\n      A imagem de fundo que tinha importado, tal como está.',
    defaultBackground: 'Predefinido',
    noTheme: 'Sem tema',
    previousAvatar: 'Avatar anterior',
    nextAvatar: 'Avatar seguinte',
    close: 'Fechar',
  },

  catalog: {
    title: 'Adicionar um mosaico',
    hint: 'Arrasta uma miniatura para a grelha para a largar aí.',
    import: 'Importar',
    theme: 'Tema',
    information: 'Informações',
    all: 'Todas',
    noMatch: 'Nenhum mosaico corresponde a estes filtros.',
    unavailableOnVehicle: 'indisponível neste veículo',
    nothingImported: 'Nada importado.',
    importedPlain: '{items} importado(s).',
    importedFrom: '{items} importado(s) de «{pack}».',
    andJoiner: 'e',
    cannotRemove: 'Este mosaico é nativo e não pode ser retirado.',
  },

  editor: {
    layout: 'Disposição',
    noRoom: 'Sem espaço: outro mosaico ocupa o lugar.',
    boardFull: 'Sem espaço: o painel está demasiado ocupado.',
    holdForSettings: 'Mantém premido para abrir as definições.',
    scale: 'Escala',
    layer: 'Camada',
    orientation: 'Orientação',
    normal: 'Normal',
    mirrored: 'Espelhado',
    whenMissing: 'Se o valor faltar',
    missingOnVehicle: 'Este valor não existe no veículo ligado.',
    missingGeneric: 'Num veículo que não o fornece.',
    hide: 'Ocultar',
    keep: 'Manter',
    delete: 'Eliminar este mosaico',
    close: 'Fechar',
    reset: 'Tamanho original',
    columns: 'Colunas',
    rows: 'Linhas',
    decrease: 'reduzir',
    increase: 'aumentar',
    tile: 'Mosaico',
    spacing: 'Espaçamento',
    spacingAuto: 'Tema',
    dressing: 'Acabamento',
    caption: 'Legenda',
    captions: {
      show: 'Visível',
      hide: 'Oculta',
      spread: 'Espalhada',
    },
    dressings: {
      default: 'Predefinido',
      borderless: 'Sem contorno',
      unfilled: 'Sem fundo',
      bare: 'Sem nada',
      feathered: 'Esbatido',
    },
    edges: 'Margens',
    edgeSides: { top: 'Cima', right: 'Direita', bottom: 'Baixo', left: 'Esquerda' },
    edgeModes: { auto: 'automático', force: 'forçado', off: 'desativado' },
  },

  keyboard: {
    title: 'Teclado',
    between: 'Entre mosaicos',
    grab: 'Agarrar, soltar',
    nudge: 'Mover uma célula',
    resize: 'Redimensionar',
    edit: 'Definições do mosaico',
  },

  editBar: {
    addTile: 'Adicionar um mosaico',
    exitEditMode: 'Sair do modo de edição',
    back: 'Voltar ao menu anterior',
    columns: 'Colunas',
    columnsShort: 'Col.',
    rows: 'Linhas',
    rowsShort: 'Lin.',
    add: 'aumentar',
    subtract: 'reduzir',
    activeLayer: 'Camada ativa: {layer}. Passar à seguinte',
  },

  status: {
    disconnected: 'Desligado',
    connecting: 'A ligar…',
    connected: 'Ligado',
    error: 'Erro de ligação',
  },

  layers: {
    background: 'Fundo',
    main: 'Principal',
    front: 'Frente',
  },

  profiles: {
    eco: 'Eco',
    normal: 'Normal',
    sporty: 'Desportivo',
    aggressive: 'Agressivo',
  },

  metrics: {
    speed: 'Velocidade',
    rpm: 'Rotações',
    gear: 'Mudança',
    throttle: 'Acelerador',
    boost: 'Turbo',
    consumption: 'Consumo instantâneo',
    consumptionRate: 'Consumo horário',
    engineLoad: 'Carga do motor',
    coolant: 'Temperatura',
    maf: 'Caudal de ar',
    lateralG: 'G lateral',
    longitudinalG: 'G longitudinal',
    tripDistance: 'Distância do percurso',
    tripAverage: 'Média do percurso',
    tripDuration: 'Duração do percurso',
    avatar: 'Avatar',
  },

  categories: {
    driving: 'Condução',
    engine: 'Motor',
    consumption: 'Consumo',
    trip: 'Percurso',
    character: 'Personagem',
  },

  avatars: {
    neonFaceLabel: 'Rosto néon',
    neonFaceDescription: 'Rosto luminoso e widgets HUD, desenhados por código.',
    plushLabel: 'Companheiro de peluche',
    plushDescription: 'Pequeno companheiro redondo, modelado por código.',
  },

  driveModes: {
    eco: 'Eco',
    normal: 'Normal',
    sport: 'Sport',
  },
  calibration: {
    title: 'Calibração',
    done: 'Calibrado',
    declareModes: 'Que modos de condução tem este veículo?',
    noModesHint: 'Não marques nenhum se não tiver seletor. Tudo o resto é medido na mesma.',
    start: 'Começar',
    next: 'Passo seguinte',
    skip: 'Saltar este passo',
    stepOf: 'Passo {index} de {total}',
    driveInMode: 'Conduz em {mode}',
    phases: {
      warmup: 'Aquece o motor',
      idle: 'Deixa ao ralenti, parado',
      drive: 'Conduz normalmente',
      done: 'Concluído',
    },
    hints: {
      warmup: 'À espera que a temperatura da água suba.',
      idle: 'Travão de mão puxado, pé fora do pedal.',
      drive: 'Estradas variadas, algumas mudanças, algumas posições do pedal.',
    },
    idle: 'Ralenti',
    redline: 'Limitador',
    topSpeed: 'Escala do velocímetro',
    turbo: 'Sobrealimentação',
    modesLearned: 'Modos aprendidos',
    measured: 'medido',
    inferred: 'deduzido',
    notMeasured: 'não medido',
    modesTooClose: 'Os modos comportam-se de forma demasiado parecida para serem distinguidos depois. Tudo o resto foi guardado.',
    yes: 'Sim',
    no: 'Não',
    apply: 'Aplicar',
    export: 'Exportar',
    openFromSettings: 'Calibrar neste veículo',
    never: 'Este veículo nunca foi calibrado.',
    lastRun: 'Calibrado a {date}',
    recalibrate: 'Repetir',
    aged: 'Calibrado há {days} dias, {count} percursos atrás.',
    revsBeyond: 'Os teus percursos atingiram desde então {rpm} rpm, acima do limitador calibrado.',
    adoptRedline: 'Adotar {rpm} rpm',
    forget: 'Esquecer',
    modesNone: 'Nenhum modo',
  },
  transfer: {
    title: 'Importar / Exportar',
    kinds: {
      people: 'pessoa',
      vehicles: 'veículo',
      appearances: 'aparência',
    },
    drop: 'Larga aqui um ficheiro de {kind}, ou toca para escolher um.',
    scope: 'Aqui só se pode importar {kind}. É acrescentado à lista, nada é substituído.',
    export: 'Exportar {name}',
    added: '{name} adicionado.',
  },
  errors: {
    unreadableArchive: 'Arquivo ilegível.',
    notABackup: 'Este ficheiro não é uma cópia TachSync.',
    incompleteArchive: 'Arquivo incompleto: falta {name}.',
    invalidJson: 'Ficheiro ilegível: não é JSON válido.',
    unexpectedObject: 'Ficheiro inesperado: esperava-se um objeto de definições.',
    foreignBackup: 'Este ficheiro não é uma cópia TachSync («{format}»).',
    unknownAvatarFormat: 'Formato não reconhecido («.{ext}»). Esperado: .riv, .glb ou .gltf.',
    avatarTooLarge: 'Ficheiro demasiado pesado ({size} MB). Limite: 64 MB.',
    notAnImage: 'Este ficheiro não é uma imagem!',
    imageTooLarge: 'Imagem demasiado pesada: {size} MB (máx. 16).',
    noTilesFound: 'Nenhum mosaico nem fundo encontrado neste ficheiro.',
    storageUnavailable: 'Armazenamento indisponível.',
    notAnEntity: 'Este ficheiro não vem do TachSync.',
    wrongEntityKind: 'Este ficheiro não contém {kind}.',
    unreadableAvatarFile: 'Não foi possível ler o ficheiro do avatar.',
    notRiveDocument: 'Este ficheiro não é um documento Rive.',
    riveDecodeFailed: 'O Rive não conseguiu descodificar este ficheiro.',
    riveNoStateMachine: 'Este ficheiro Rive não tem máquina de estados: não há nada para animar.',
    notGltfModel: 'Este ficheiro não é um modelo glTF binário.',
    gltfDecodeFailed: 'Não foi possível descodificar este modelo.',
  },
};
