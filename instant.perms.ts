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
}

export default rules
