# RxDB/Quasar → InstantDB/PrimeVue Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Vollständige Migration von RxDB zu InstantDB und von Quasar zu PrimeVue in einem Big-Bang-Ansatz.

**Architecture:** Stores nutzen InstantDB's `subscribeQuery` für reaktive Daten und `transact` für Schreiboperationen. UI-Komponenten werden 1:1 von Quasar zu PrimeVue gemappt. Tests werden parallel zu jeder Komponente angepasst.

**Tech Stack:** Vue 3, Pinia, InstantDB (self-hosted), PrimeVue 4, Playwright E2E

---

## Task 1: RxDB-Infrastruktur entfernen

**Files:**
- Delete: `src/db/schema.ts`
- Delete: `src/db/database.ts`
- Delete: `src/composables/useDatabase.ts`
- Delete: `src/stores/vehicles-instant.ts` (Proof of Concept)

**Step 1: RxDB-Dateien löschen**

```bash
rm src/db/schema.ts src/db/database.ts src/composables/useDatabase.ts src/stores/vehicles-instant.ts
rmdir src/db
```

**Step 2: RxDB-Packages deinstallieren**

```bash
npm uninstall rxdb rxdb-premium
```

**Step 3: Verify removal**

```bash
grep -r "rxdb" src/ --include="*.ts" --include="*.vue"
```
Expected: Viele Treffer (werden in folgenden Tasks gefixt)

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove RxDB infrastructure"
```

---

## Task 2: Vehicles Store migrieren

**Files:**
- Modify: `src/stores/vehicles.ts`
- Modify: `src/lib/instantdb.ts`

**Step 1: InstantDB Types erweitern**

In `src/lib/instantdb.ts` die Vehicle-Typen anpassen:

```typescript
export interface VehicleScheduleItem {
  type: string
  label: string
  intervalKm: number
  intervalMonths: number
}

export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  mileage: number
  vin?: string
  licensePlate: string
  customSchedule?: VehicleScheduleItem[]
  createdAt: string
  updatedAt: string
}
```

**Step 2: Vehicles Store komplett ersetzen**

`src/stores/vehicles.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db, id, tx } from '../lib/instantdb'
import type { Vehicle, VehicleScheduleItem } from '../lib/instantdb'

export type { Vehicle, VehicleScheduleItem }

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load() {
    if (unsubscribe) return

    isLoading.value = true
    error.value = null

    unsubscribe = db.subscribeQuery(
      { vehicles: {} },
      (result) => {
        if (result.error) {
          error.value = new Error(result.error.message)
          isLoading.value = false
          return
        }
        if (result.data) {
          vehicles.value = (result.data.vehicles || []) as Vehicle[]
          isLoading.value = false
        }
      },
    )
  }

  async function add(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.vehicles as any)[newId].update({
        ...vehicle,
        createdAt: now,
        updatedAt: now,
      }),
    ])
  }

  async function remove(vehicleId: string) {
    await db.transact([
      (tx.vehicles as any)[vehicleId].delete(),
    ])
  }

  async function update(vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>>) {
    await db.transact([
      (tx.vehicles as any)[vehicleId].update({
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    ])
  }

  async function updateMileage(vehicleId: string, mileage: number) {
    await update(vehicleId, { mileage })
  }

  async function updateCustomSchedule(vehicleId: string, schedule: VehicleScheduleItem[]) {
    await update(vehicleId, { customSchedule: schedule })
  }

  return {
    vehicles,
    isLoading,
    error,
    load,
    add,
    remove,
    update,
    updateMileage,
    updateCustomSchedule,
  }
})
```

**Step 3: Commit**

```bash
git add src/stores/vehicles.ts src/lib/instantdb.ts && git commit -m "feat: migrate vehicles store to InstantDB"
```

---

## Task 3: Invoices Store migrieren

**Files:**
- Modify: `src/stores/invoices.ts`
- Modify: `src/lib/instantdb.ts`

**Step 1: Invoice Types in instantdb.ts**

```typescript
export interface InvoiceItem {
  description: string
  category: string
  amount: number
}

export interface Invoice {
  id: string
  vehicleId: string
  workshopName?: string
  date: string
  totalAmount?: number
  currency?: string
  mileageAtService?: number
  imageData?: string
  ocrCacheId?: string
  items?: InvoiceItem[]
  createdAt: string
  updatedAt: string
}
```

**Step 2: Invoices Store ersetzen**

`src/stores/invoices.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db, id, tx } from '../lib/instantdb'
import type { Invoice, InvoiceItem } from '../lib/instantdb'

export type { Invoice, InvoiceItem }

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<Invoice[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load() {
    if (unsubscribe) return

    isLoading.value = true
    unsubscribe = db.subscribeQuery(
      { invoices: {} },
      (result) => {
        if (result.error) {
          error.value = new Error(result.error.message)
          isLoading.value = false
          return
        }
        if (result.data) {
          invoices.value = (result.data.invoices || []) as Invoice[]
          isLoading.value = false
        }
      },
    )
  }

  function getByVehicleId(vehicleId: string): Invoice[] {
    return invoices.value.filter(i => i.vehicleId === vehicleId)
  }

  async function add(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.invoices as any)[newId].update({
        ...invoice,
        createdAt: now,
        updatedAt: now,
      }),
    ])
    return newId
  }

  async function remove(invoiceId: string) {
    await db.transact([
      (tx.invoices as any)[invoiceId].delete(),
    ])
  }

  async function update(invoiceId: string, data: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>) {
    await db.transact([
      (tx.invoices as any)[invoiceId].update({
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    ])
  }

  return {
    invoices,
    isLoading,
    error,
    load,
    getByVehicleId,
    add,
    remove,
    update,
  }
})
```

**Step 3: Commit**

```bash
git add src/stores/invoices.ts src/lib/instantdb.ts && git commit -m "feat: migrate invoices store to InstantDB"
```

---

## Task 4: Maintenances Store migrieren

**Files:**
- Modify: `src/stores/maintenances.ts`
- Modify: `src/lib/instantdb.ts`

**Step 1: Maintenance Types in instantdb.ts**

```typescript
export interface Maintenance {
  id: string
  vehicleId: string
  invoiceId?: string
  type: string
  description?: string
  doneAt: string
  mileageAtService: number
  nextDueDate?: string
  nextDueMileage?: number
  status: 'done' | 'due' | 'overdue'
  createdAt: string
  updatedAt: string
}
```

**Step 2: Maintenances Store ersetzen**

```typescript
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db, id, tx } from '../lib/instantdb'
import type { Maintenance } from '../lib/instantdb'

export type { Maintenance }

export const useMaintenancesStore = defineStore('maintenances', () => {
  const maintenances = ref<Maintenance[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load() {
    if (unsubscribe) return

    isLoading.value = true
    unsubscribe = db.subscribeQuery(
      { maintenances: {} },
      (result) => {
        if (result.error) {
          error.value = new Error(result.error.message)
          isLoading.value = false
          return
        }
        if (result.data) {
          maintenances.value = (result.data.maintenances || []) as Maintenance[]
          isLoading.value = false
        }
      },
    )
  }

  function getByVehicleId(vehicleId: string): Maintenance[] {
    return maintenances.value.filter(m => m.vehicleId === vehicleId)
  }

  async function add(maintenance: Omit<Maintenance, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.maintenances as any)[newId].update({
        ...maintenance,
        createdAt: now,
        updatedAt: now,
      }),
    ])
    return newId
  }

  async function remove(maintenanceId: string) {
    await db.transact([
      (tx.maintenances as any)[maintenanceId].delete(),
    ])
  }

  async function removeByVehicleAndType(vehicleId: string, type: string) {
    const toRemove = maintenances.value.filter(
      m => m.vehicleId === vehicleId && m.type === type
    )
    if (toRemove.length === 0) return

    await db.transact(
      toRemove.map(m => (tx.maintenances as any)[m.id].delete())
    )
  }

  async function update(maintenanceId: string, data: Partial<Omit<Maintenance, 'id' | 'createdAt' | 'updatedAt'>>) {
    await db.transact([
      (tx.maintenances as any)[maintenanceId].update({
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    ])
  }

  return {
    maintenances,
    isLoading,
    error,
    load,
    getByVehicleId,
    add,
    remove,
    removeByVehicleAndType,
    update,
  }
})
```

**Step 3: Commit**

```bash
git add src/stores/maintenances.ts src/lib/instantdb.ts && git commit -m "feat: migrate maintenances store to InstantDB"
```

---

## Task 5: Chat Service migrieren

**Files:**
- Modify: `src/services/chat.ts`
- Modify: `src/lib/instantdb.ts`

**Step 1: ChatMessage Type in instantdb.ts**

```typescript
export interface ChatAttachment {
  type: string
  name: string
  preview: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: ChatAttachment[]
  createdAt: string
}
```

**Step 2: Chat Service anpassen**

Ersetze alle RxDB-Aufrufe:
- `db.chatmessages.insert()` → `db.transact([tx.chatmessages[id()].update(...)])`
- `db.chatmessages.find()` → `db.queryOnce({ chatmessages: {} })`

**Step 3: Commit**

```bash
git add src/services/chat.ts src/lib/instantdb.ts && git commit -m "feat: migrate chat service to InstantDB"
```

---

## Task 6: AI Service (OCR Cache) migrieren

**Files:**
- Modify: `src/services/ai.ts`
- Modify: `src/lib/instantdb.ts`

**Step 1: OcrCache Type in instantdb.ts**

```typescript
export interface OcrCache {
  id: string  // SHA-256 hash
  markdown: string
  createdAt: string
}
```

**Step 2: AI Service anpassen**

Ersetze OCR-Cache-Funktionen.

**Step 3: Commit**

```bash
git add src/services/ai.ts src/lib/instantdb.ts && git commit -m "feat: migrate OCR cache to InstantDB"
```

---

## Task 7: DB Export Service migrieren

**Files:**
- Modify: `src/services/db-export.ts`

**Step 1: Export/Import für InstantDB anpassen**

```typescript
import { db, id, tx } from '../lib/instantdb'

export async function exportDatabase(): Promise<string> {
  const result = await db.queryOnce({
    vehicles: {},
    invoices: {},
    maintenances: {},
    chatmessages: {},
    ocrcache: {},
  })

  return JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    data: result.data,
  }, null, 2)
}

export async function importDatabase(json: string): Promise<{ imported: Record<string, number> }> {
  const parsed = JSON.parse(json)
  const data = parsed.data || parsed
  const imported: Record<string, number> = {}

  for (const [collection, items] of Object.entries(data)) {
    if (!Array.isArray(items)) continue
    const transactions = items.map((item: any) =>
      (tx as any)[collection][item.id || id()].update(item)
    )
    if (transactions.length > 0) {
      await db.transact(transactions)
      imported[collection] = transactions.length
    }
  }

  return { imported }
}
```

**Step 2: Commit**

```bash
git add src/services/db-export.ts && git commit -m "feat: migrate db-export to InstantDB"
```

---

## Task 8: Pages von RxDB-Abhängigkeiten befreien

**Files:**
- Modify: `src/pages/DashboardPage.vue`
- Modify: `src/pages/VehicleDetailPage.vue`
- Modify: `src/pages/SettingsPage.vue`

Entferne `useDatabase` imports und ersetze direkte DB-Aufrufe durch Store-Methoden.

**Commit:**

```bash
git add src/pages/*.vue && git commit -m "refactor: remove RxDB dependencies from pages"
```

---

## Task 9: Quasar aus main.ts entfernen

**Files:**
- Modify: `src/main.ts`

**Step 1: Quasar-Imports entfernen und PrimeVue-Services hinzufügen**

```typescript
import Aura from '@primeuix/themes/aura'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import 'primeicons/primeicons.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark-mode',
      cssLayer: false,
    },
  },
})
app.use(ToastService)
app.use(ConfirmationService)
app.mount('#app')
```

**Step 2: Quasar deinstallieren**

```bash
npm uninstall quasar @quasar/extras
```

**Step 3: Commit**

```bash
git add src/main.ts package.json package-lock.json && git commit -m "chore: remove Quasar, configure PrimeVue services"
```

---

## Task 10: App.vue Layout migrieren

**Files:**
- Modify: `src/App.vue`

Neues PrimeVue Layout mit Sidebar, Menubar, Toast.

**Commit:**

```bash
git add src/App.vue && git commit -m "feat: migrate App.vue to PrimeVue layout"
```

---

## Task 11-16: Komponenten migrieren

Für jede Komponente:
1. Quasar-Imports durch PrimeVue ersetzen
2. Template anpassen
3. Test anpassen
4. Einzeln committen

**Reihenfolge:**
- Task 11: VehicleCard.vue
- Task 12: VehicleForm.vue
- Task 13: InvoiceResult.vue
- Task 14: InvoiceScanner.vue
- Task 15: MediaViewer.vue
- Task 16: ChatDrawer.vue

---

## Task 17-21: Pages migrieren

**Reihenfolge:**
- Task 17: VehiclesPage.vue
- Task 18: DashboardPage.vue
- Task 19: VehicleDetailPage.vue
- Task 20: ScanPage.vue
- Task 21: SettingsPage.vue

---

## Task 22: Alle E2E-Tests fixen

**Files:**
- Modify: `e2e/*.spec.ts` (14 Dateien)

Selektoren anpassen, Tests durchlaufen lassen.

---

## Task 23: Cleanup und finale Verifikation

```bash
npm run lint:fix
npm run build
npm run test:e2e
```

Expected: 33 passed

---

## Zusammenfassung

| Phase | Tasks | Commits |
|-------|-------|---------|
| Infrastruktur | 1 | 1 |
| Stores | 2-4 | 3 |
| Services | 5-7 | 3 |
| Pages (RxDB) | 8 | 1 |
| main.ts + Layout | 9-10 | 2 |
| Komponenten | 11-16 | 6 |
| Pages (UI) | 17-21 | 5 |
| Tests | 22 | ~14 |
| Cleanup | 23 | 1 |
| **Total** | **23** | **~36** |
