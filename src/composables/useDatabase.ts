import type { RxDatabase } from 'rxdb'
import { ref } from 'vue'
import { createDatabase } from '../db/database'

let dbPromise: Promise<RxDatabase> | null = null

export function useDatabase() {
  const db = ref<RxDatabase | null>(null)
  const ready = ref(false)

  if (!dbPromise) {
    dbPromise = createDatabase()
  }

  dbPromise.then((database) => {
    db.value = database
    ready.value = true
  })

  return { db, ready, dbPromise: dbPromise! }
}
