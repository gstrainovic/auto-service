# Migration Design: RxDB → InstantDB + Quasar → PrimeVue

**Datum:** 2026-02-03
**Status:** Phase 1-3 ✅ Abgeschlossen | Phase 4-5 ⏳ Offen

## Fortschritt

| Phase | Beschreibung | Status |
|-------|--------------|--------|
| Phase 1 | Infrastruktur (RxDB entfernen) | ✅ Erledigt |
| Phase 2 | Stores (vehicles, invoices, maintenances) | ✅ Erledigt |
| Phase 3 | Services (chat, ai, db-export) | ✅ Erledigt |
| Phase 4 | UI-Komponenten (Quasar → PrimeVue) | ⏳ Nicht begonnen |
| Phase 5 | Cleanup (Quasar deinstallieren) | ⏳ Nicht begonnen |

**E2E-Tests:** 33/33 bestanden ✅

## Entscheidungen

| Thema | Entscheidung | Begründung |
|-------|--------------|------------|
| Migrations-Ansatz | Big Bang | App klein genug, kein Misch-Code |
| Datenmigration | Frischer Start | Export/Import existiert als Backup |
| UI-Styling | PrimeVue Aura | Bereits konfiguriert, modern |
| Test-Strategie | Parallel anpassen | Kontinuierliches Feedback |

## Migrations-Reihenfolge

### Phase 1: Infrastruktur
1. RxDB entfernen (`src/db/`)
2. InstantDB aktivieren (`src/lib/instantdb.ts`)
3. Packages deinstallieren: `rxdb`, `rxdb-premium`

### Phase 2: Stores
1. `vehicles.ts` → InstantDB
2. `invoices.ts` → InstantDB
3. `maintenances.ts` → InstantDB

### Phase 3: Services
1. `chat.ts` → InstantDB
2. `ai.ts` → InstantDB (OCR-Cache)
3. `db-export.ts` → InstantDB

### Phase 4: UI-Komponenten (Bottom-Up)
1. Kleine: VehicleCard, VehicleForm, InvoiceResult
2. Komplex: MediaViewer, InvoiceScanner
3. Pages: Dashboard, Vehicles, VehicleDetail, Scan, Settings
4. Layout: App.vue
5. Chat: ChatDrawer (zuletzt)

### Phase 5: Cleanup
1. Quasar deinstallieren
2. Alle 33 Tests grün

## Komponenten-Mapping

| Quasar | PrimeVue |
|--------|----------|
| `q-btn` | `Button` |
| `q-input` | `InputText` / `InputNumber` |
| `q-select` | `Select` |
| `q-dialog` | `Dialog` |
| `q-card` | `Card` |
| `q-list/item` | Custom div oder Listbox |
| `q-tabs` | `Tabs` + `TabPanels` |
| `q-page` | `<main>` + CSS |
| `q-layout/drawer` | `Sidebar` |
| `q-toolbar` | Custom header |
| `q-icon` | PrimeIcons (`pi pi-*`) |
| `q-banner` | `Message` |
| `q-badge` | `Badge` |
| `q-chip` | `Chip` |
| `q-spinner` | `ProgressSpinner` |
| `q-notify` | `Toast` |

## Datenmodell (Schemaless)

InstantDB ist schemaless - keine Schema-Definition nötig.
TypeScript-Interfaces nur für IDE-Unterstützung.

### Entitäten
- `vehicles` - Fahrzeuge
- `invoices` - Rechnungen (vehicleId Referenz)
- `maintenances` - Wartungen (vehicleId Referenz)
- `chatmessages` - Chat-Verlauf
- `ocrcache` - OCR-Cache (UUID als ID, Hash als Feld)

## Datei-Änderungen

### Löschen
- `src/db/schema.ts`
- `src/db/database.ts`
- `src/composables/useDatabase.ts`

### Ändern
- `src/lib/instantdb.ts`
- `src/stores/*.ts` (3 Dateien)
- `src/services/*.ts` (3 Dateien)
- `src/main.ts`
- `src/App.vue`
- `src/components/*.vue` (6 Dateien)
- `src/pages/*.vue` (5 Dateien)
- `e2e/*.spec.ts` (14 Dateien)

### Packages entfernen
```bash
npm uninstall rxdb rxdb-premium quasar @quasar/extras
```
