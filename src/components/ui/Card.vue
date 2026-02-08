<script setup lang="ts">
import type { CardVariant } from '../../types/ui'

interface Props {
  variant?: CardVariant
  padding?: boolean
  hover?: boolean
}

const _props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: true,
  hover: false,
})
</script>

<template>
  <div
    class="ui-card" :class="[
      `ui-card--${variant}`,
      { 'ui-card--no-padding': !padding },
      { 'ui-card--hover': hover },
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.ui-card {
  background: var(--surface-section);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.ui-card--default {
  padding: var(--spacing-lg);
}

.ui-card--elevated {
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-md);
}

.ui-card--outlined {
  padding: var(--spacing-lg);
  border: 1px solid var(--surface-border);
}

.ui-card--no-padding {
  padding: 0 !important;
}

.ui-card--hover:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
</style>
