const rules = {
  vehicles: {
    allow: {
      view: 'isOwner',
      create: 'isOwner',
      update: 'isOwner && isStillOwner',
      delete: 'isOwner',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.creatorId',
      isStillOwner: 'auth.id != null && auth.id == newData.creatorId',
    },
  },
  invoices: {
    allow: {
      view: 'isOwner',
      create: 'isOwner',
      update: 'isOwner && isStillOwner',
      delete: 'isOwner',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.creatorId',
      isStillOwner: 'auth.id != null && auth.id == newData.creatorId',
    },
  },
  maintenances: {
    allow: {
      view: 'isOwner',
      create: 'isOwner',
      update: 'isOwner && isStillOwner',
      delete: 'isOwner',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.creatorId',
      isStillOwner: 'auth.id != null && auth.id == newData.creatorId',
    },
  },
  chatmessages: {
    allow: {
      view: 'isOwner',
      create: 'isOwner',
      update: 'isOwner',
      delete: 'isOwner',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.creatorId',
    },
  },
  ocrcache: {
    allow: {
      view: 'isOwner',
      create: 'isOwner',
      update: 'isOwner',
      delete: 'isOwner',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.creatorId',
    },
  },
  // Nutzereinstellungen (E-Mail-Erinnerungen); der Erinnerungs-Job schreibt per Admin-Token lastReminderAt/Key
  settings: {
    allow: {
      view: 'isOwner',
      create: 'isOwner',
      update: 'isOwner && isStillOwner',
      delete: 'isOwner',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.creatorId',
      isStillOwner: 'auth.id != null && auth.id == newData.creatorId',
    },
  },
  // Nutzungszähler und Abos: schreibt nur der AI-Proxy (Admin-SDK), Nutzer lesen nur ihre eigenen
  usage: {
    allow: {
      view: 'isOwner',
      create: 'false',
      update: 'false',
      delete: 'false',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.userId',
    },
  },
  subscriptions: {
    allow: {
      view: 'isOwner',
      create: 'false',
      update: 'false',
      delete: 'false',
    },
    bind: {
      isOwner: 'auth.id != null && auth.id == data.userId',
    },
  },
  // Landing Pages (Validierung): Klicks schreibt jeder Besucher ohne Login,
  // lesen darf niemand über den Client; Auswertung nur im Dashboard oder per Admin-SDK
  events: {
    allow: {
      view: 'false',
      create: 'true',
      update: 'false',
      delete: 'false',
    },
  },
}

export default rules
