<script setup lang="ts">
// Einziges Logo von Wartungsheft, dieselbe Datei wie das Favicon. Das Auto (pi-car) steht in der App für Fahrzeuge,
// nicht für die Marke.
withDefaults(defineProps<{ size?: string }>(), { size: '1.75rem' })
</script>

<template>
  <img src="/favicon.svg" alt="" class="app-logo" data-testid="app-logo" :style="{ width: size, height: size }">
</template>

<style scoped>
.app-logo {
  display: block;
  flex-shrink: 0;
}
</style>
