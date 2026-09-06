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
}

export default rules
